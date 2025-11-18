import chalk from "chalk";
import { ChatAnthropic } from "@langchain/anthropic";
import { createAgent, createMiddleware } from "langchain";
import type { AgentMiddleware } from "langchain";
import { createSubAgentMiddleware } from "deepagents";
import type { SubAgent } from "deepagents";
import { ToolMessage } from "@langchain/core/messages";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { AgentAction, AgentFinish } from "@langchain/core/agents";
import type { Serialized } from "@langchain/core/load/serializable";
import type { LLMResult } from "@langchain/core/outputs";
import {
  injectPromptVariables,
  type BiasDetectionPromptVariables,
} from "./prompts/inject-variables";

export class BiasDetectionCallbackHandler extends BaseCallbackHandler {
  name = "BiasDetectionCallbackHandler";
  private currentAgent = "";
  private agentColors: Record<string, typeof chalk.magenta> = {
    coordinator: chalk.magenta,
    "fact-checker": chalk.cyan,
    "context-analyzer": chalk.blue,
    "source-verifier": chalk.green,
  };

  handleChainStart(
    chain: Serialized,
    inputs: Record<string, unknown>,
    _runId: string,
    parentRunId?: string,
  ): void {
    const chainType = chain.id?.[chain.id.length - 1];

    if (chainType === "RunnableSequence" && !parentRunId) {
      this.currentAgent = "coordinator";
    }

    if (chainType === "RunnableSequence" && parentRunId) {
      const agentName = this.inferAgentName(inputs);
      if (agentName && agentName !== "coordinator") {
        this.currentAgent = agentName;
      }
    }
  }

  handleLLMStart(
    _llm: Serialized,
    _prompts: string[],
    _runId: string,
    _parentRunId?: string,
  ): void {}

  handleChatModelStart(
    _llm: Serialized,
    _messages: unknown[][],
    _runId: string,
    _parentRunId?: string,
  ): void {}

  handleLLMEnd(result: LLMResult, _runId: string): void {
    if (!result.generations || result.generations.length === 0) return;

    const generation = result.generations[0]?.[0];
    if (!generation) return;

    let content = "";

    if (generation.text) {
      content = generation.text;
    }

    if (!content && generation.generationInfo) {
      const info = generation.generationInfo as Record<string, unknown>;
      if (info.content && typeof info.content === "string") {
        content = info.content;
      }
    }

    if (content && content.trim() && this.currentAgent) {
      const color = this.agentColors[this.currentAgent] || chalk.white;

      const lines = content.split("\n");
      const firstLine = lines[0] || "";
      const restOfContent = lines.slice(1).join("\n");

      console.log(color(`\n← ${this.currentAgent}: ${firstLine}`));

      if (restOfContent.trim()) {
        const truncated = restOfContent.length > 300
          ? restOfContent.slice(0, 300) + "..."
          : restOfContent;
        console.log(chalk.gray(truncated));
      }
    }
  }

  handleToolStart(
    tool: Serialized,
    input: string,
    _runId: string,
    _parentRunId?: string,
  ): void {
    let toolName = "unknown";
    const toolObj = tool as unknown as Record<string, unknown>;

    if (toolObj.kwargs && typeof toolObj.kwargs === "object") {
      const kwargs = toolObj.kwargs as Record<string, unknown>;
      if (kwargs.name && typeof kwargs.name === "string") {
        toolName = kwargs.name;
      }
    }

    if (toolName === "unknown" && tool.id && Array.isArray(tool.id)) {
      toolName = tool.id[tool.id.length - 1] || "unknown";
    }

    if (toolName === "DynamicStructuredTool") {
      try {
        const parsedInput = JSON.parse(input);

        if (parsedInput.subagent_type && parsedInput.description) {
          const subagentType = parsedInput.subagent_type;
          const description = parsedInput.description;

          const truncated =
            description.length > 200
              ? description.slice(0, 200) + "..."
              : description;
          console.log(
            chalk.magenta(`\n→ coordinator to ${subagentType}: ${truncated}`),
          );
        } else if (parsedInput.query && parsedInput.sourceType) {
          console.log(chalk.gray(`  [retrieving documents...]`));
        }
      } catch {}
    }
  }

  handleToolEnd(_output: string, _runId: string): void {}

  handleAgentAction(_action: AgentAction, _runId: string): void {}

  handleAgentEnd(_finish: AgentFinish, _runId: string): void {
    if (this.currentAgent) {
      const color = this.agentColors[this.currentAgent] || chalk.white;
      console.log(color(`  ✓ Completed`));
    }
  }

  private inferAgentName(inputs: Record<string, unknown>): string | null {
    const inputStr = JSON.stringify(inputs);
    if (inputStr.includes("fact-checker")) return "fact-checker";
    if (inputStr.includes("context-analyzer")) return "context-analyzer";
    if (inputStr.includes("source-verifier")) return "source-verifier";
    if (inputStr.includes("coordinator")) return "coordinator";
    return null;
  }
}

export interface CoordinatorConfig {
  subagents: SubAgent[];
  coordinatorPrompt: string;
  model?: string;
  temperature?: number;
  promptVariables: BiasDetectionPromptVariables;
}

export function createBiasDetectionCoordinator(
  config: CoordinatorConfig,
): {
  coordinator: ReturnType<typeof createAgent>;
  callbackHandler: BiasDetectionCallbackHandler;
} {
  const {
    subagents,
    coordinatorPrompt,
    model: modelName = "claude-sonnet-4-5-20250929",
    temperature = 0,
  } = config;

  const callbackHandler = new BiasDetectionCallbackHandler();

  const dynamicPrompt = injectPromptVariables(
    config.coordinatorPrompt,
    config.promptVariables,
  );

  const model = new ChatAnthropic({
    model: modelName,
    temperature: temperature,
    cache: true,
    callbacks: [callbackHandler],
  });

  const toolErrorHandler = createMiddleware({
    name: "ToolErrorHandler",
    wrapToolCall: async (request, handler) => {
      try {
        return await handler(request);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log(
          chalk.yellow(
            `   ⚠️  Tool error (${request.toolCall.name}): ${errorMessage}`,
          ),
        );
        return new ToolMessage({
          content: `Tool encountered an error. This is not critical - you can continue without this information.`,
          tool_call_id: request.toolCall.id!,
        });
      }
    },
  });

  const subAgentMiddleware = createSubAgentMiddleware({
    subagents: subagents,
    defaultModel: "gpt-4o-mini",
  });

  const middleware = [
    toolErrorHandler,
    subAgentMiddleware,
  ] as const as unknown as readonly AgentMiddleware[];

  const coordinator = createAgent({
    name: "coordinator",
    model: model,
    tools: [],
    systemPrompt: dynamicPrompt,
    middleware: middleware,
  });

  return { coordinator, callbackHandler };
}
