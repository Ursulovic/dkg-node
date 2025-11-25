import { z } from "zod";

import {
  createAgent,
  tool,
  toolCallLimitMiddleware,
  type ResponseFormat,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import type { RunnableToolLike } from "@langchain/core/runnables";

import { generatePrompt } from "./prompt.js";
import { ClaimResearchResponseJsonSchema } from "./schema";
import { webSearchTool } from "./tools/web-search";
import { googleScholarSearchTool } from "./tools/google-scholar-search";
import { wikipediaSearchTool } from "./tools/wikipedia-query";
import { DEPTH_CONFIGS, type AnalysisDepth } from "../../types/depth.js";
import { type CostTracker } from "../../utils/costTracker.js";

const MODEL_NAME = "gpt-4o-mini";

function createModel(costTracker?: CostTracker) {
  return new ChatOpenAI({
    model: MODEL_NAME,
    temperature: 0,
    cache: true,
    callbacks: costTracker
      ? [
          {
            handleLLMEnd(output) {
              const usage = output.llmOutput?.tokenUsage;
              if (usage) {
                costTracker.trackTokens(MODEL_NAME, {
                  inputTokens: usage.promptTokens ?? 0,
                  outputTokens: usage.completionTokens ?? 0,
                });
              }
            },
          },
        ]
      : undefined,
  });
}

function wrapToolWithTracking<T extends RunnableToolLike>(
  originalTool: T,
  apiName: string,
  costTracker?: CostTracker
): T {
  if (!costTracker) {
    return originalTool;
  }

  const originalInvoke = originalTool.invoke.bind(originalTool);
  return {
    ...originalTool,
    invoke: async (...args: Parameters<typeof originalTool.invoke>) => {
      costTracker.trackApiCall(apiName);
      return originalInvoke(...args);
    },
  } as T;
}

export function createClaimResearcherAgent(
  depth: AnalysisDepth = "medium",
  costTracker?: CostTracker
) {
  const config = DEPTH_CONFIGS[depth];
  const model = createModel(costTracker);

  const wrappedWebSearch = wrapToolWithTracking(
    webSearchTool,
    "tavily-basic",
    costTracker
  );
  const wrappedGoogleScholar = wrapToolWithTracking(
    googleScholarSearchTool,
    "serpapi",
    costTracker
  );
  const wrappedWikipedia = wrapToolWithTracking(
    wikipediaSearchTool,
    "wikipedia",
    costTracker
  );

  return createAgent({
    name: "claim-researcher",
    model,
    tools: [wrappedWebSearch, wrappedGoogleScholar, wrappedWikipedia],
    contextSchema: z.object({}),
    responseFormat: ClaimResearchResponseJsonSchema as ResponseFormat,
    systemPrompt: generatePrompt(config),
    middleware: [
      toolCallLimitMiddleware({
        toolName: "web-search",
        runLimit: config.toolCallsPerTool,
        exitBehavior: "continue",
      }),
      toolCallLimitMiddleware({
        toolName: "google_scholar_search",
        runLimit: config.toolCallsPerTool,
        exitBehavior: "continue",
      }),
      toolCallLimitMiddleware({
        toolName: "wikipedia_query",
        runLimit: config.toolCallsPerTool,
        exitBehavior: "continue",
      }),
      toolCallLimitMiddleware({
        runLimit: config.toolCallsPerTool * 3 + config.toolCallBuffer,
        exitBehavior: "continue",
      }),
    ],
  });
}

const DivergenceTypeEnum = z.enum([
  "contradiction",
  "unsupported-addition",
  "omitted-context",
  "framing-difference",
]);

const researchClaimToolSchema = z.object({
  claim: z
    .string()
    .describe(
      "EXACT verbatim text from Grokipedia article. Must be self-contained (understandable without context). Will be used for UI highlighting - must match source exactly.",
    ),
  divergenceType: DivergenceTypeEnum.describe(
    "Type of divergence from Wikipedia: contradiction (Grok says X, Wiki says not-X), unsupported-addition (claim not in Wiki), omitted-context (Wiki has context Grok omits), framing-difference (same facts, different tone)",
  ),
  verificationTask: z
    .string()
    .describe(
      "Specific verification task. For contradictions: 'Wikipedia states X, verify actual value'. For additions: 'Not in Wikipedia, find supporting evidence'. Be specific about what to verify.",
    ),
  urlsExtractedFromSource: z
    .array(z.string())
    .describe(
      "URLs referenced near this claim in Grokipedia. Context only - tool will verify using authoritative sources.",
    ),
  section: z
    .string()
    .describe(
      "Section name in Grokipedia where claim appears (e.g., 'Introduction', 'Controversy').",
    ),
});

const researchClaimToolDescription =
  "Verify a specific claim from Grokipedia. Pass: exact verbatim claim text, divergence type (contradiction/addition/omission/framing), specific verification task, source URLs, section name. The verification task tells you exactly what to look for. Returns: issue explanation, confidence score, sources used.";

export function createResearchClaimTool(
  depth: AnalysisDepth = "medium",
  costTracker?: CostTracker
) {
  const claimResearcherAgent = createClaimResearcherAgent(depth, costTracker);

  return tool(
    async ({ claim, divergenceType, verificationTask, urlsExtractedFromSource, section }) => {
      const response = await claimResearcherAgent.invoke(
        {
          messages: [
            {
              role: "user",
              content: `## Claim to Verify
"${claim}"

## Divergence Type
${divergenceType}

## Verification Task
${verificationTask}

## Article Section
${section}

## Source URLs (for context only)
${urlsExtractedFromSource.length > 0 ? urlsExtractedFromSource.join("\n") : "None provided"}`,
            },
          ],
        },
        { recursionLimit: 100 },
      );
      return response.structuredResponse;
    },
    {
      name: "research_claim",
      description: researchClaimToolDescription,
      schema: researchClaimToolSchema,
    },
  );
}

export const researchClaimTool = createResearchClaimTool("medium");

export default createClaimResearcherAgent("medium");
