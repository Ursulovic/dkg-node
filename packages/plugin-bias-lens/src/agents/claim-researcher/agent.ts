import { z } from "zod";

import {
  createAgent,
  tool,
  toolCallLimitMiddleware,
  type ResponseFormat,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";

import { generatePrompt } from "./prompt.js";
import { ClaimResearchResponseJsonSchema } from "./schema";
import { webSearchTool } from "./tools/web-search";
import { googleScholarSearchTool } from "./tools/google-scholar-search";
import { wikipediaSearchTool } from "./tools/wikipedia-query";
import { DEPTH_CONFIGS, type AnalysisDepth } from "../../types/depth.js";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  cache: true,
});

export function createClaimResearcherAgent(depth: AnalysisDepth = "medium") {
  const config = DEPTH_CONFIGS[depth];

  return createAgent({
    name: "claim-researcher",
    model,
    tools: [webSearchTool, googleScholarSearchTool, wikipediaSearchTool],
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

export function createResearchClaimTool(depth: AnalysisDepth = "medium") {
  const claimResearcherAgent = createClaimResearcherAgent(depth);

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
