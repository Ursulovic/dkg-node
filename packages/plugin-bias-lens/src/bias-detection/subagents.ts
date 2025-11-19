import { createAgent, tool } from "langchain";
import type { StructuredTool } from "@langchain/core/tools";
import type { SectionTracker } from "./section-tracker";
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
  QUALITY_ASSURANCE_NAME,
  QUALITY_ASSURANCE_DESCRIPTION,
  QUALITY_ASSURANCE_PROMPT,
} from "./prompts/subagents/quality-assurance";
import {
  injectPromptVariables,
  type BiasDetectionPromptVariables,
} from "./prompts/inject-variables";
import { createSectionReaderTool } from "./tools/create-section-reader-tool";
import { createQAReviewerTool } from "./tools/create-qa-reviewer-tool";
import * as z from "zod";

export interface SubagentToolsConfig {
  sectionTracker: SectionTracker;
  tavilySearch: StructuredTool;
  googleScholar: StructuredTool;
  promptVariables?: BiasDetectionPromptVariables;
}

/**
 * Creates subagent tools for the coordinator to use
 * Following LangChain's Tool Calling pattern for multi-agent systems
 */
export function createSubagentTools({
  sectionTracker,
  tavilySearch,
  googleScholar,
  promptVariables = {},
}: SubagentToolsConfig) {
  const analysisModel = "gpt-4o-mini";
  const qaModel = "gemini-2.5-flash";

  // Create section_reader tools for each analysis agent
  const factCheckerSectionReader = createSectionReaderTool(
    sectionTracker,
    "fact-checker",
  );
  const contextAnalyzerSectionReader = createSectionReaderTool(
    sectionTracker,
    "context-analyzer",
  );
  const sourceVerifierSectionReader = createSectionReaderTool(
    sectionTracker,
    "source-verifier",
  );

  // Create qa_reviewer tool for QA agent
  const qaReviewerTool = createQAReviewerTool(sectionTracker);

  // Create subagents using createAgent
  const factCheckerAgent = createAgent({
    name: FACT_CHECKER_NAME,
    model: analysisModel,
    tools: [
      factCheckerSectionReader,
      tavilySearch,
      googleScholar,
    ] as unknown as StructuredTool[],
    systemPrompt: injectPromptVariables(FACT_CHECKER_PROMPT, promptVariables),
  });

  const contextAnalyzerAgent = createAgent({
    name: CONTEXT_ANALYZER_NAME,
    model: analysisModel,
    tools: [contextAnalyzerSectionReader] as unknown as StructuredTool[], // Only needs section_reader
    systemPrompt: injectPromptVariables(
      CONTEXT_ANALYZER_PROMPT,
      promptVariables,
    ),
  });

  const sourceVerifierAgent = createAgent({
    name: SOURCE_VERIFIER_NAME,
    model: analysisModel,
    tools: [
      sourceVerifierSectionReader,
      tavilySearch,
      googleScholar,
    ] as unknown as StructuredTool[],
    systemPrompt: injectPromptVariables(
      SOURCE_VERIFIER_PROMPT,
      promptVariables,
    ),
  });

  const qualityAssuranceAgent = createAgent({
    name: QUALITY_ASSURANCE_NAME,
    model: qaModel,
    tools: [qaReviewerTool] as unknown as StructuredTool[], // Only needs qa_reviewer
    systemPrompt: QUALITY_ASSURANCE_PROMPT,
  });

  // Wrap subagents as tools for the coordinator
  const callFactChecker = tool(
    async (input: any) => {
      const result = await factCheckerAgent.invoke({
        messages: [{ role: "user", content: input.instruction }],
      });
      return result.messages.at(-1)?.content || "No response";
    },
    {
      name: FACT_CHECKER_NAME,
      description: FACT_CHECKER_DESCRIPTION,
      schema: z.object({
        instruction: z
          .string()
          .describe("Task instruction for the fact-checker agent"),
      }),
    },
  );

  const callContextAnalyzer = tool(
    async (input: any) => {
      const result = await contextAnalyzerAgent.invoke({
        messages: [{ role: "user", content: input.instruction }],
      });
      return result.messages.at(-1)?.content || "No response";
    },
    {
      name: CONTEXT_ANALYZER_NAME,
      description: CONTEXT_ANALYZER_DESCRIPTION,
      schema: z.object({
        instruction: z
          .string()
          .describe("Task instruction for the context-analyzer agent"),
      }),
    },
  );

  const callSourceVerifier = tool(
    async (input: any) => {
      const result = await sourceVerifierAgent.invoke({
        messages: [{ role: "user", content: input.instruction }],
      });
      return result.messages.at(-1)?.content || "No response";
    },
    {
      name: SOURCE_VERIFIER_NAME,
      description: SOURCE_VERIFIER_DESCRIPTION,
      schema: z.object({
        instruction: z
          .string()
          .describe("Task instruction for the source-verifier agent"),
      }),
    },
  );

  const callQualityAssurance = tool(
    async (input: any) => {
      const result = await qualityAssuranceAgent.invoke({
        messages: [{ role: "user", content: input.instruction }],
      });
      return result.messages.at(-1)?.content || "No response";
    },
    {
      name: QUALITY_ASSURANCE_NAME,
      description: QUALITY_ASSURANCE_DESCRIPTION,
      schema: z.object({
        instruction: z
          .string()
          .describe("Task instruction for the quality-assurance agent"),
      }),
    },
  );

  return {
    callFactChecker,
    callContextAnalyzer,
    callSourceVerifier,
    callQualityAssurance,
  };
}
