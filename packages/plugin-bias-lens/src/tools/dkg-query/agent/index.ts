import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { traceable } from "langsmith/traceable";
import type { DkgClient, DkgQueryInput, DkgQueryResult } from "../types.js";
import {
  createSearchSchemaTool,
  createExecuteSparqlTool,
} from "./tools/index.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

export const createDkgQueryAgent = (dkgClient: DkgClient) => {
  const tools = [
    createSearchSchemaTool(dkgClient),
    createExecuteSparqlTool(dkgClient),
  ];

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  });

  return createReactAgent({
    llm: model,
    tools,
    messageModifier: SYSTEM_PROMPT,
  });
};

interface ToolCall {
  name: string;
  args?: { sparql?: string };
}

interface AgentMessage {
  content: string | unknown;
  tool_calls?: ToolCall[];
}

export const runDkgQueryAgent = traceable(
  async (input: DkgQueryInput, dkgClient: DkgClient): Promise<DkgQueryResult> => {
    const agent = createDkgQueryAgent(dkgClient);

    const result = await agent.invoke({
      messages: [{ role: "user", content: input.query }],
    });

    const executedQueries: string[] = [];
    for (const message of result.messages as AgentMessage[]) {
      if (message.tool_calls) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.name === "execute_sparql" && toolCall.args?.sparql) {
            executedQueries.push(toolCall.args.sparql);
          }
        }
      }
    }

    const lastMessage = result.messages[result.messages.length - 1] as AgentMessage | undefined;
    if (!lastMessage) {
      return {
        success: false,
        answer: "",
        executedQueries: [],
        error: "No response from agent",
      };
    }

    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    return {
      success: true,
      answer: content,
      executedQueries,
    };
  },
  {
    name: "dkg-query",
    run_type: "chain",
    processInputs: (inputs) => {
      const args = inputs as unknown as { args: [DkgQueryInput, DkgClient] };
      return { query: args.args[0]?.query };
    },
    processOutputs: (outputs) => {
      const result = outputs as DkgQueryResult;
      return {
        success: result.success,
        answer: result.answer,
        queriesExecuted: result.executedQueries.length,
      };
    },
  }
);
