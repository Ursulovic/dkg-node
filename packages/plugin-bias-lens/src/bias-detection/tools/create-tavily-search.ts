import { TavilySearch } from "@langchain/tavily";

export function createTavilySearchTool() {
  return new TavilySearch({
    maxResults: 1,
    tavilyApiKey: process.env.TAVILY_API_KEY,
    name: "web_search",
    includeAnswer: true,
    description:
      "Search the web using Tavily to fact-check claims, verify information, and find supporting evidence. " +
      "Use this when you need to verify facts against current web sources, check if claims are accurate, " +
      "or find additional context that isn't in the vector database. " +
      "Input should be a search query string with relevant keywords (e.g., 'climate change 97% consensus study', 'Smith et al 2023 climate paper').",
  });
}
