import { SERPGoogleScholarAPITool } from "@langchain/community/tools/google_scholar";

export function createGoogleScholarTool() {
  return new SERPGoogleScholarAPITool({
    apiKey: process.env.SERPAPI_API_KEY,
  });
}
