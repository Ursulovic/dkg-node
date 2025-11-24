import { z } from "zod";

import { createAgent, tool, toolCallLimitMiddleware } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

import systemPrompt from "./prompt";
import responseFormat from "./schema";
import { webSearchTool } from "./tools/web-search";
import { googleScholarSearchTool } from "./tools/google-scholar-search";
import { wikipediaSearchTool } from "./tools/wikipedia-query";

const model = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
  cache: true,
});

const claimResearcherAgent = createAgent({
  name: "claim-researcher",
  model,
  tools: [webSearchTool, googleScholarSearchTool, wikipediaSearchTool],
  contextSchema: z.object({}),
  responseFormat,
  systemPrompt,
  middleware: [
    toolCallLimitMiddleware({
      toolName: "web-search",
      runLimit: 2,
      exitBehavior: "continue",
    }),
    toolCallLimitMiddleware({
      toolName: "google_scholar_search",
      runLimit: 2,
      exitBehavior: "continue",
    }),
    toolCallLimitMiddleware({
      toolName: "wikipedia_query",
      runLimit: 2,
      exitBehavior: "continue",
    }),
    toolCallLimitMiddleware({
      runLimit: 8,
      exitBehavior: "end",
    }),
  ],
});

export const researchClaimTool = tool(
  async ({ claim, urlsExtractedFromSource, section }) => {
    const response = await claimResearcherAgent.invoke(
      {
        messages: [
          {
            role: "user",
            content: `Research this claim: "${claim}"\n\nArticle section: ${section}\n\nSource URLs for context: ${urlsExtractedFromSource.join(", ")}`,
          },
        ],
      },
      { recursionLimit: 100 },
    );
    return response.structuredResponse;
  },
  {
    name: "research_claim",
    description:
      "Efficiently research a specific claim using the most appropriate verification tool (Wikipedia for encyclopedia facts, Google Scholar for scientific claims, web search for recent news/events). This tool automatically selects ONE optimal verification method based on claim type, finds 1-2 authoritative sources, and stops as soon as sufficient evidence is found. Returns ClaimResearch object with verified sources (each classified by credibility tier: peer-reviewed > systematic-review > government > academic-institution > major-news-outlet > think-tank > blog-opinion), confidence score (0.0-1.0 based on source quality), detailed issue explanation, and which tool was used for verification. IMPORTANT: Use this tool for EVERY significant claim that needs verification. The tool is designed to be efficient - it will stop after finding good evidence rather than exhaustively searching.",
    schema: z.object({
      claim: z
        .string()
        .describe(
          "The exact claim text from the Grokipedia article to verify. Be precise and include the full claim.",
        ),
      urlsExtractedFromSource: z
        .array(z.string())
        .describe(
          "Array of URLs referenced in or near this claim in the source article. These provide context for verification but should not be used as conclusive evidence - the tool will verify using appropriate authoritative sources.",
        ),
      section: z
        .string()
        .describe(
          "The section name in the Grokipedia article where this claim appears (e.g., 'Introduction', 'Scientific Evidence', 'Controversy', 'History'). This helps categorize findings by article section.",
        ),
    }),
  },
);

export default claimResearcherAgent;
