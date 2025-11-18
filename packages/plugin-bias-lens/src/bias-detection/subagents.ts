import type { SubAgent } from "deepagents";
import type { StructuredTool } from "@langchain/core/tools";
import {
  FACT_CHECKER_NAME,
  FACT_CHECKER_DESCRIPTION,
  FACT_CHECKER_PROMPT,
} from "./prompts/subagents/fact-checker";
import {
  CONTEXT_ANALYZER_NAME,
  CONTEXT_ANALYZER_DESCRIPTION,
  CONTEXT_ANALYZER_PROMPT,
} from "./prompts/subagents/context-analyzer";
import {
  SOURCE_VERIFIER_NAME,
  SOURCE_VERIFIER_DESCRIPTION,
  SOURCE_VERIFIER_PROMPT,
} from "./prompts/subagents/source-verifier";
import {
  injectPromptVariables,
  type BiasDetectionPromptVariables,
} from "./prompts/inject-variables";

export interface SubagentToolsConfig {
  pineconeRetriever: StructuredTool;
  tavilySearch?: StructuredTool;
  googleScholar?: StructuredTool;
  promptVariables: BiasDetectionPromptVariables;
}

export function createSubagentConfigs({
  pineconeRetriever,
  tavilySearch,
  googleScholar,
  promptVariables,
}: SubagentToolsConfig): SubAgent[] {
  const modelName = "gpt-4o-mini";

  return [
    {
      name: FACT_CHECKER_NAME,
      model: modelName,
      description: FACT_CHECKER_DESCRIPTION,
      systemPrompt: injectPromptVariables(FACT_CHECKER_PROMPT, promptVariables),
      tools: [
        pineconeRetriever,
        tavilySearch,
        googleScholar,
      ] as unknown as SubAgent["tools"],
    },
    {
      name: CONTEXT_ANALYZER_NAME,
      model: modelName,
      description: CONTEXT_ANALYZER_DESCRIPTION,
      systemPrompt: injectPromptVariables(
        CONTEXT_ANALYZER_PROMPT,
        promptVariables,
      ),
      tools: [pineconeRetriever] as unknown as SubAgent["tools"],
    },
    {
      name: SOURCE_VERIFIER_NAME,
      model: modelName,
      description: SOURCE_VERIFIER_DESCRIPTION,
      systemPrompt: injectPromptVariables(
        SOURCE_VERIFIER_PROMPT,
        promptVariables,
      ),
      tools: [pineconeRetriever] as unknown as SubAgent["tools"],
    },
  ];
}
