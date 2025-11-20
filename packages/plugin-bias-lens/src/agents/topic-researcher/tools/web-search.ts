import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";

const webSearchSchema = z.object({
  query: z
    .string()
    .describe(
      "The search query string. Be specific and detailed to get the most relevant results.",
    ),
});

export const webSearchTool = new TavilySearch({
  maxResults: 3,
  tavilyApiKey: process.env.TAVILY_API_KEY,
  includeImageDescriptions: true,
}).asTool({
  name: "web-search",
  description: `Searches for matching article pairs across Grokipedia and Wikipedia for a given topic. Accepts natural language queries (e.g., "research COVID-19", "find articles about climate change") and returns validated URLs for both platforms. The agent automatically handles ambiguous queries by asking 3-5 clarifying questions, corrects common misspellings, and validates all URLs before returning results. Returns a JSON object with status (success/failure/need_clarification), validated URLs for both platforms, or detailed error messages explaining what went wrong. Requires both platforms to have the topic or reports failure - partial results are not returned.`,
  schema: webSearchSchema,
});
