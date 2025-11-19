import { z } from "zod";
import { ClientTool, ServerTool } from "@langchain/core/tools";
import { TavilySearch } from "@langchain/tavily";
import { SERPGoogleScholarAPITool } from "@langchain/community/tools/google_scholar";

const tools: (ServerTool | ClientTool)[] = [
  new TavilySearch({
    maxResults: 3,
    tavilyApiKey: process.env.TAVILY_API_KEY,
    includeImageDescriptions: true,
  }).asTool({
    name: "web-search",
    description:
      "Search the web for recent news, current events, policy announcements, official statements, and breaking information. This tool is appropriate for: (1) Recent events and news (within the last 12 months), (2) Political statements, executive orders, and policy changes, (3) Direct quotes from individuals or organizations, (4) Official announcements from governments or institutions, (5) Background context on recent controversies, (6) When google_scholar_search returns no results for a claim. DO NOT use this as the primary tool for scientific, medical, or statistical claims - those require peer-reviewed sources from google_scholar_search. News articles, editorials, and blog posts are NOT peer-reviewed evidence and will result in lower confidence scores when used for scientific claims. Use web_search for 'what happened' but google_scholar for 'what does the science say'. Returns web pages, news articles, official documents, and recent online content.",
    schema: z.object({
      query: z
        .string()
        .describe(
          "The search query string. Be specific and detailed to get the most relevant results.",
        ),
      includeDomains: z
        .array(z.string())
        .describe(
          "List of domains to specifically include in search results (e.g., ['wikipedia.org', 'nature.com']). Only results from these domains will be returned.",
        ),
      excludeDomains: z
        .array(z.string())
        .describe(
          "List of domains to exclude from search results (e.g.['reddit.com', 'quora.com']). Results from these domains will be filtered out.",
        ),
      searchDepth: z
        .enum(["basic", "advanced"])
        .describe(
          "Depth of the search. 'basic' provides quick results, 'advanced' performs deeper analysis and returns more comprehensive information. Default: 'basic'.",
        ),
      includeImages: z
        .boolean()
        .describe(
          "Whether to include a list of query-related images in the response. Default: false.",
        ),
      timeRange: z.enum(["day", "week", "month", "year"]),
      topic: z.enum(["general", "news", "finance"]),
    }),
  }),

  new SERPGoogleScholarAPITool({
    apiKey: process.env.SERPAPI_API_KEY,
  }).asTool({
    name: "google_scholar_search",
    description:
      "Search Google Scholar for peer-reviewed academic papers, journal articles, systematic reviews, and scholarly literature. This is the PRIMARY tool for verifying scientific, medical, or statistical claims. Use this tool when you need to find: (1) Peer-reviewed research papers on ANY scientific or medical topic, (2) Systematic reviews or meta-analyses for evidence synthesis, (3) Original studies cited by name in the article you're fact-checking, (4) Academic consensus on controversial scientific questions, (5) Statistical data from published research, (6) Any claim that involves biology, medicine, psychology, climate science, or other scientific fields. MANDATORY for verifying any claim that cites a specific study, journal, or research finding. Always prefer this over web_search for scientific claims to ensure peer-reviewed evidence. Returns academic papers with titles, authors, publication info, citations, and abstracts.",
    schema: z.object({
      input: z.string().describe("Search query string"),
    }),
  }),
];

export default tools;
