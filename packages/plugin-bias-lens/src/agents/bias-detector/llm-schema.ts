import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const BiasLevelEnum = z.enum(["none", "low", "moderate", "high", "severe"]);

const ReviewAspectEnum = z.enum([
  "factualError",
  "missingContext",
  "sourceProblem",
  "mediaIssue",
]);

const CitationTypeEnum = z.enum(["ScholarlyArticle", "WebPage"]);

const LLMCitationSchema = z
  .object({
    type: CitationTypeEnum.describe(
      "ScholarlyArticle for peer-reviewed/academic sources, WebPage for government/news/other sources"
    ),
    name: z.string().describe("Title of the source"),
    url: z.string().describe("URL to the source"),
    author: z
      .string()
      .nullish()
      .describe("Author(s) of the source, comma-separated if multiple"),
    abstract: z
      .string()
      .nullish()
      .describe("Brief summary or abstract of the source"),
    citationCount: z
      .number()
      .int()
      .nonnegative()
      .nullish()
      .describe("Number of citations (for scholarly articles)"),
  })
  .describe("Citation in schema.org format - maps directly to knowledge asset");

const LLMRatingSchema = z
  .object({
    ratingValue: z
      .number()
      .int()
      .min(1)
      .max(5)
      .describe("Confidence rating: 1=low confidence, 5=high confidence"),
    ratingExplanation: z
      .string()
      .describe("Brief explanation of the confidence level"),
  })
  .describe("Rating for a claim review");

const LLMClaimReviewSchema = z
  .object({
    claimReviewed: z
      .string()
      .describe("The exact claim from Grokipedia being evaluated"),
    reviewBody: z
      .string()
      .describe("Detailed explanation of the issue with evidence"),
    reviewRating: LLMRatingSchema,
    itemReviewed: z
      .object({
        text: z.string().describe("The claim text being reviewed"),
      })
      .describe("The claim being reviewed"),
    articleSection: z
      .string()
      .describe("Section in Grokipedia where this claim appears"),
    reviewAspect: ReviewAspectEnum.describe(
      "Type of issue: factualError (false claims), missingContext (omissions), sourceProblem (unreliable sources), mediaIssue (image/video/audio problems)"
    ),
    citation: z
      .array(LLMCitationSchema)
      .min(1)
      .describe("Evidence sources supporting this finding"),
  })
  .describe(
    "ClaimReview in schema.org format - maps directly to knowledge asset hasPart"
  );

const LLMSummarySchema = z
  .object({
    overview: z
      .string()
      .describe(
        "2-3 sentence summary of bias analysis findings - maps to reviewBody"
      ),
    biasLevel: BiasLevelEnum.describe(
      "Overall bias severity: none=aligned, low=minor, moderate=notable, high=serious, severe=extreme"
    ),
    keyPatterns: z
      .array(z.string())
      .describe(
        "Major patterns detected (e.g., 'Cherry-picking statistics') - maps to keywords"
      ),
    negativeNotesDescription: z
      .string()
      .describe(
        "Summary like '3 factual errors, 2 missing context' - maps directly to negativeNotes.description"
      ),
  })
  .describe("Summary that maps directly to public report fields");

const LLMSimilaritySchema = z
  .object({
    overallAlignment: z
      .number()
      .min(0)
      .max(1)
      .describe("Overall alignment score (0.0=completely different, 1.0=identical)"),
    semanticSimilarity: z
      .number()
      .min(0)
      .max(1)
      .describe("Semantic similarity from content analysis (0.0-1.0)"),
    structuralSimilarity: z
      .number()
      .min(0)
      .max(1)
      .describe("Structural similarity of sections and organization (0.0-1.0)"),
    interpretation: z
      .string()
      .describe(
        "What the similarity scores mean and whether divergence is concerning"
      ),
  })
  .describe("Content similarity analysis - maps to private review section");

const LLMResponseSchema = z
  .object({
    summary: LLMSummarySchema,
    claimReviews: z
      .array(LLMClaimReviewSchema)
      .describe(
        "Array of ClaimReview objects - maps directly to private hasPart without conversion"
      ),
    similarity: LLMSimilaritySchema,
  })
  .describe(
    "LLM response structured for direct mapping to knowledge asset. System adds: @context, @id, datePublished, publisher, creator, offers, computed metrics."
  );

export type LLMResponse = z.infer<typeof LLMResponseSchema>;
export type LLMClaimReview = z.infer<typeof LLMClaimReviewSchema>;
export type LLMCitation = z.infer<typeof LLMCitationSchema>;
export type LLMSummary = z.infer<typeof LLMSummarySchema>;
export type LLMSimilarity = z.infer<typeof LLMSimilaritySchema>;
export type BiasLevel = z.infer<typeof BiasLevelEnum>;
export type ReviewAspect = z.infer<typeof ReviewAspectEnum>;
export type CitationType = z.infer<typeof CitationTypeEnum>;

export {
  LLMResponseSchema,
  LLMClaimReviewSchema,
  LLMCitationSchema,
  LLMSummarySchema,
  LLMSimilaritySchema,
  BiasLevelEnum,
  ReviewAspectEnum,
  CitationTypeEnum,
};

export const LLMResponseJsonSchema = zodToJsonSchema(LLMResponseSchema, {
  $refStrategy: "none",
  target: "openAi",
});

export default LLMResponseSchema;
