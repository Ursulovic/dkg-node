import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const CredibilityTierEnum = z.enum([
  "peer-reviewed",
  "systematic-review",
  "government",
  "academic-institution",
  "major-news-outlet",
  "think-tank",
  "blog-opinion",
]);

const ToolNameEnum = z.enum([
  "google_scholar_search",
  "web_search",
  "wikipedia_query",
]);

const SourceSchema = z
  .object({
    name: z
      .string()
      .describe("Name of the authoritative source used to verify this claim"),
    url: z.string().describe("URL to the authoritative source"),
    credibilityTier: CredibilityTierEnum.describe(
      "Evidence hierarchy tier: peer-reviewed > systematic-review > government > academic-institution > major-news-outlet > think-tank > blog-opinion"
    ),
    authors: z
      .string()
      .nullish()
      .describe(
        "Comma-separated author names (from Google Scholar). Null for non-Scholar sources."
      ),
    snippet: z
      .string()
      .nullish()
      .describe(
        "Abstract or summary text (from Google Scholar). Null for non-Scholar sources."
      ),
    totalCitations: z
      .number()
      .int()
      .nonnegative()
      .nullish()
      .describe(
        "Total citation count (from Google Scholar). Higher citations = stronger evidence. Null for non-Scholar sources."
      ),
  })
  .required();

export const ClaimResearchResponseSchema = z
  .object({
    issue: z
      .string()
      .describe(
        "Explanation of the problem: what is false, misleading, missing, or cherry-picked"
      ),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe(
        "Confidence level (0.0-1.0) based on source quality: 0.85-1.0=peer-reviewed, 0.6-0.85=government/news, 0.3-0.6=blog/opinion, 0.0-0.3=contradicted"
      ),
    sources: z
      .array(SourceSchema)
      .min(1)
      .describe(
        "Array of authoritative sources supporting this finding. Multiple sources strengthen verification."
      ),
    toolsUsed: z
      .array(ToolNameEnum)
      .min(1)
      .describe(
        "Array of verification tools used: google_scholar_search for scientific claims, web_search for news/events, wikipedia_query for encyclopedia facts."
      ),
  })
  .required()
  .describe(
    "Minimal claim research response. The caller (bias-detector) provides claim, section, and type."
  );

export type ClaimResearchResponse = z.infer<typeof ClaimResearchResponseSchema>;

export const ClaimResearchResponseJsonSchema = zodToJsonSchema(
  ClaimResearchResponseSchema,
  {
    $refStrategy: "none",
    target: "openAi",
  }
);

export default ClaimResearchResponseSchema;
