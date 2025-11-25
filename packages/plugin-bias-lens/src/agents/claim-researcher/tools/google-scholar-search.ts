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
    "Search Google Scholar for peer-reviewed academic papers and research. Use for: scientific, medical, or statistical claims; cited studies; research findings. Returns: papers with titles, authors, citations, abstracts. MANDATORY for any claim citing specific studies or making scientific assertions.",
  schema: googleScholarSchema,
});
