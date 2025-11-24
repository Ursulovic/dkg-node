import { z } from "zod";
import { SERPGoogleScholarAPITool } from "@langchain/community/tools/google_scholar";

const googleScholarSchema = z.object({
  input: z.string().describe("Search query string"),
});

export const googleScholarSearchTool = new SERPGoogleScholarAPITool({
  apiKey: process.env.SERPAPI_API_KEY,
}).asTool({
  name: "google_scholar_search",
  description:
    "Search Google Scholar for peer-reviewed academic papers, journal articles, systematic reviews, and scholarly literature. This is the PRIMARY tool for verifying scientific, medical, or statistical claims. Use this tool when you need to find: (1) Peer-reviewed research papers on ANY scientific or medical topic, (2) Systematic reviews or meta-analyses for evidence synthesis, (3) Original studies cited by name in the article you're fact-checking, (4) Academic consensus on controversial scientific questions, (5) Statistical data from published research, (6) Any claim that involves biology, medicine, psychology, climate science, or other scientific fields. MANDATORY for verifying any claim that cites a specific study, journal, or research finding. Always prefer this over web_search for scientific claims to ensure peer-reviewed evidence. Returns academic papers with titles, authors, publication info, citations, and abstracts.",
  schema: googleScholarSchema,
});
