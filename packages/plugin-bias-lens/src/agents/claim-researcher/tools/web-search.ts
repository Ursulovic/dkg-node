import { z } from "zod";
import { TavilySearch } from "@langchain/tavily";

const webSearchSchema = z
  .object({
    query: z
      .string()
      .describe(
        "The search query string. Be specific and detailed to get the most relevant results.",
      ),
    includeDomains: z
      .array(z.string())
      .describe(
        "Full domain names to include (e.g., ['nih.gov', 'nature.com']). Use empty array [] for broad search. Must be complete domains, NOT TLD suffixes like 'edu' or 'gov'.",
      ),
    excludeDomains: z
      .array(z.string())
      .describe(
        "Full domain names to exclude (e.g., ['reddit.com', 'quora.com']). Must be complete domains, NOT TLD suffixes.",
      ),
    searchDepth: z
      .enum(["basic", "advanced"])
      .describe("Depth of search: 'basic' for quick results, 'advanced' for deeper analysis."),
    includeImages: z.boolean().describe("Whether to include query-related images in the response."),
    timeRange: z.enum(["day", "week", "month", "year"]).describe("Time range for results."),
    topic: z.enum(["general", "news", "finance"]).describe("Topic category for the search."),
  })
  .required();

export const webSearchTool = new TavilySearch({
  maxResults: 3,
  tavilyApiKey: process.env.TAVILY_API_KEY,
  includeImageDescriptions: true,
}).asTool({
  name: "web-search",
  description:
    "Search the web for recent news, current events, and official announcements. Use for: events within last 12 months, political statements, direct quotes, policy changes. Returns: web pages, news articles, official documents with URLs. NOT for scientific/medical claims - use google_scholar_search instead.",
  schema: webSearchSchema,
});
