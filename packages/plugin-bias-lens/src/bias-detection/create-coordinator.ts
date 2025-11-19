import { createAgent } from "langchain";
import type { StructuredTool } from "@langchain/core/tools";

import {
  injectPromptVariables,
  type BiasDetectionPromptVariables,
} from "./prompts/inject-variables";

export interface CoordinatorConfig {
  subagentTools: StructuredTool[];
  coordinatorPrompt: string;
  model?: string;
  promptVariables?: BiasDetectionPromptVariables;
  tools?: StructuredTool[];
}

/**
 * Creates a coordinator agent using LangChain's Tool Calling pattern
 * The coordinator treats subagents as tools to be invoked when needed
 */
export function createBiasDetectionCoordinator(
  config: CoordinatorConfig,
): ReturnType<typeof createAgent> {
  const {
    subagentTools,
    coordinatorPrompt,
    model = "claude-sonnet-4-5-20250929",
    tools = [],
    promptVariables = {},
  } = config;

  const dynamicPrompt = injectPromptVariables(
    coordinatorPrompt,
    promptVariables,
  );

  // Combine coordinator-specific tools with subagent tools
  const allTools = [...tools, ...subagentTools] as unknown as StructuredTool[];

  return createAgent({
    name: "coordinator",
    model: model,
    tools: allTools,
    systemPrompt: dynamicPrompt,
  });
}
