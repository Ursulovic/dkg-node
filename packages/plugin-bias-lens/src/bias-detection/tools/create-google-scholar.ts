import { SERPGoogleScholarAPITool } from "@langchain/community/tools/google_scholar";
import { StructuredTool } from "@langchain/core/tools";

export function createGoogleScholarTool() {
  return new SERPGoogleScholarAPITool({
    apiKey: process.env.SERPAPI_API_KEY,
  }) as unknown as StructuredTool;
}
