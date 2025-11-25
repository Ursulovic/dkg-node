import { z } from "zod";

const CredibilityTierEnum = z.enum([
  "peer-reviewed",
  "systematic-review",
  "government",
  "academic-institution",
  "major-news-outlet",
  "think-tank",
  "blog-opinion",
]);

const BiasLevelEnum = z.enum(["none", "low", "moderate", "high", "severe"]);

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

const ToolsUsedSchema = z
  .array(ToolNameEnum)
  .min(1)
  .describe(
    "Array of verification tools used for this claim: google_scholar_search for scientific claims, web_search for news/events, wikipedia_query for encyclopedia facts. Multiple tools indicate cross-verification."
  );

const FactualErrorSchema = z
  .object({
    claim: z.string().describe("The exact claim from Grokipedia being evaluated"),
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
    toolsUsed: ToolsUsedSchema,
    section: z
      .string()
      .describe("Section name in the Grokipedia article where this issue appears"),
  })
  .required();

const MissingContextSchema = z
  .object({
    claim: z.string().describe("The exact claim from Grokipedia being evaluated"),
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
    toolsUsed: ToolsUsedSchema,
    section: z
      .string()
      .describe("Section name in the Grokipedia article where this issue appears"),
  })
  .required();

const SourceProblemSchema = z
  .object({
    sourceName: z
      .string()
      .describe("Name of the unreliable source used by Grokipedia"),
    issue: z
      .string()
      .describe(
        "Why this source is problematic: low credibility, bias, conflicts of interest, no editorial standards"
      ),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("Confidence that this source is unreliable (0.0-1.0)"),
    evidenceSources: z
      .array(SourceSchema)
      .min(1)
      .describe("Authoritative sources documenting this source's unreliability"),
    toolsUsed: ToolsUsedSchema,
    section: z
      .string()
      .describe("Section in Grokipedia that relies on this source"),
  })
  .required();

const MediaIssueSchema = z
  .object({
    mediaType: z.enum(["image", "video", "audio"]).describe("Type of media content"),
    description: z
      .string()
      .describe("Description of the media element in Grokipedia"),
    issue: z
      .string()
      .describe(
        "Problem identified: manipulation, misattribution, misleading caption, missing context, or fabrication"
      ),
    confidence: z
      .number()
      .min(0)
      .max(1)
      .describe("Confidence level that this media issue exists (0.0-1.0)"),
    sources: z
      .array(SourceSchema)
      .min(1)
      .describe(
        "Sources verifying the media issue (original source, fact-check, forensic analysis)"
      ),
    toolsUsed: ToolsUsedSchema,
    section: z.string().describe("Section name where this media appears"),
  })
  .required();

const ExecutiveSummarySchema = z
  .object({
    overview: z
      .string()
      .describe("High-level summary of bias analysis findings (2-3 sentences)"),
    biasLevel: BiasLevelEnum.describe(
      "Overall bias severity: none=aligned with Wikipedia, low=minor issues, moderate=notable problems, high=serious bias, severe=extensive misinformation"
    ),
    keyPatterns: z
      .array(z.string())
      .describe(
        "Major patterns of bias detected (e.g., 'Cherry-picking statistics', 'Omission of scientific consensus')"
      ),
  })
  .required()
  .describe("Executive summary providing quick assessment of bias");

const OverallAssessmentSchema = z
  .object({
    overallBiasConfidence: z
      .number()
      .min(0)
      .max(1)
      .describe(
        "Overall confidence that significant bias exists (0.0=no bias, 1.0=extreme bias confirmed)"
      ),
    totalFactualErrors: z
      .number()
      .int()
      .nonnegative()
      .describe("Total count of factual errors (hallucinations + false claims)"),
    totalMissingContext: z
      .number()
      .int()
      .nonnegative()
      .describe("Total count of missing context issues (omissions + cherry-picking)"),
    totalSourceProblems: z
      .number()
      .int()
      .nonnegative()
      .describe("Total count of unreliable sources"),
    totalMediaIssues: z
      .number()
      .int()
      .nonnegative()
      .describe("Total count of media problems"),
  })
  .required()
  .describe("Overall assessment with aggregate statistics");

const LLMContentSimilaritySchema = z
  .object({
    overallAlignment: z
      .number()
      .min(0)
      .max(1)
      .describe("Overall alignment score (0.0=completely different, 1.0=identical)"),
    alignmentDescription: z
      .string()
      .describe(
        "Human-readable alignment level: 'High alignment', 'Moderate alignment', 'Low alignment', 'No alignment'"
      ),
    structuralSimilarity: z
      .number()
      .min(0)
      .max(1)
      .describe("Structural similarity of sections and organization (0.0-1.0)"),
    interpretation: z
      .string()
      .describe(
        "Interpretation of what similarity scores mean and whether divergence is concerning"
      ),
  })
  .required()
  .describe("Content similarity analysis fields filled by LLM");

const LLMContextSchema = z
  .object({
    "@vocab": z.string().describe("Base vocabulary URL for the ontology"),
    bias: z.string().describe("Bias ontology namespace URL"),
    schema: z.string().describe("Schema.org namespace URL"),
    grokipedia: z.string().optional().describe("Grokipedia base URL"),
    wikipedia: z.string().optional().describe("Wikipedia base URL"),
  })
  .required()
  .describe("JSON-LD context defining namespaces and vocabularies");

const LLMResponseSchema = z
  .object({
    "@context": LLMContextSchema,
    "@type": z
      .literal("BiasDetectionReport")
      .describe("JSON-LD type identifier for this report"),
    articleTitle: z.string().describe("Title of the article being analyzed"),
    grokipediaUrl: z.string().describe("Full URL to the Grokipedia article"),
    wikipediaUrl: z.string().describe("Full URL to the Wikipedia article for comparison"),
    executiveSummary: ExecutiveSummarySchema,
    factualErrors: z
      .array(FactualErrorSchema)
      .describe(
        "All factual errors: hallucinations (fabricated information) and false claims (inaccurate or misrepresented information). Both require peer-reviewed sources for scientific claims."
      ),
    missingContext: z
      .array(MissingContextSchema)
      .describe(
        "Missing context issues: significant omissions (important information left out) and cherry-picking (selective presentation creating misleading impression)."
      ),
    sourceProblems: z
      .array(SourceProblemSchema)
      .describe("Unreliable or low-quality sources used by Grokipedia"),
    mediaIssues: z
      .array(MediaIssueSchema)
      .describe(
        "Image, video, or audio problems: manipulation, misattribution, misleading context, or fabrication"
      ),
    overallAssessment: OverallAssessmentSchema,
    contentSimilarity: LLMContentSimilaritySchema,
  })
  .required()
  .describe("LLM-generated bias detection response (without system-computed fields)");

const SourceVersionSchema = z
  .object({
    grokipedia: z
      .object({
        url: z.string(),
        accessedAt: z.string().datetime(),
        pageHash: z
          .string()
          .optional()
          .describe("SHA-256 hash of page content for verification"),
      })
      .required()
      .describe("Grokipedia source version metadata"),
    wikipedia: z
      .object({
        url: z.string(),
        accessedAt: z.string().datetime(),
        revisionId: z
          .string()
          .optional()
          .describe("Wikipedia revision ID for exact version tracking"),
        pageHash: z
          .string()
          .optional()
          .describe("SHA-256 hash of page content for verification"),
      })
      .required()
      .describe("Wikipedia source version metadata"),
  })
  .required();

const JsonLdContextSchema = z
  .object({
    "@vocab": z.literal("https://schema.org/"),
    prov: z.literal("http://www.w3.org/ns/prov#"),
    x402: z.literal("https://x402.org/payment#"),
  })
  .describe("JSON-LD context with schema.org, PROV-O, and x402 namespaces");

const RatingSchema = z.object({
  "@type": z.literal("Rating"),
  ratingValue: z.number().int().min(1).max(5),
  bestRating: z.literal(5),
  worstRating: z.literal(1),
  ratingExplanation: z.string(),
});

const PropertyValueSchema = z.object({
  "@type": z.literal("PropertyValue"),
  propertyID: z.string(),
  value: z.union([z.number(), z.string()]),
  description: z.string().optional(),
});

const ProvEntitySchema = z.object({
  "@type": z.literal("prov:Entity"),
  "@id": z.string(),
  "prov:generatedAtTime": z.string().datetime(),
  identifier: z.string().optional(),
});

const PublisherSchema = z.object({
  "@type": z.literal("Organization"),
  name: z.string(),
  "x402:walletAddress": z.string(),
  "x402:paymentNetwork": z.literal("otp:20430"),
  "x402:paymentToken": z.literal("TRAC"),
});

const StakeSchema = z.object({
  amount: z.string(),
  confidence: z.number().min(0).max(1),
  txHash: z.string().optional(),
  contractAddress: z.string().optional(),
});

const AnalysisMetadataSchema = z.object({
  tokenUsage: z.number().int().nonnegative(),
  costUSD: z.number().nonnegative(),
  costTRAC: z.number().nonnegative(),
  publishingCost: z.number().nonnegative(),
  readCostMultiplier: z.number().positive(),
  calculatedReadCost: z.number().nonnegative(),
  traceId: z.string().optional(),
  traceUrl: z.string().optional(),
});

const SoftwareAgentSchema = z.object({
  "@type": z.literal("SoftwareApplication"),
  name: z.string(),
  softwareVersion: z.string(),
});

const ProvenanceActivitySchema = z.object({
  "@type": z.literal("prov:Activity"),
  "prov:wasAssociatedWith": SoftwareAgentSchema,
  "prov:used": z.array(z.string()),
  description: z.string().optional(),
  "x402:stake": StakeSchema.optional(),
});

const ItemListSchema = z.object({
  "@type": z.literal("ItemList"),
  numberOfItems: z.number().int().nonnegative(),
  description: z.string(),
});

const ArticleRefSchema = z.object({
  "@type": z.literal("Article"),
  url: z.string(),
  name: z.string().optional(),
});

const PublicBiasReportSchema = z
  .object({
    "@context": JsonLdContextSchema,
    "@type": z.literal("Review"),
    "@id": z.string().nullable(),
    itemReviewed: ArticleRefSchema,
    isBasedOn: ArticleRefSchema,
    publisher: PublisherSchema,
    reviewRating: RatingSchema,
    reviewBody: z.string(),
    keywords: z.array(z.string()),
    negativeNotes: ItemListSchema,
    additionalProperty: z.array(PropertyValueSchema),
    "x402:analysisMetadata": AnalysisMetadataSchema,
    "prov:wasGeneratedBy": ProvenanceActivitySchema,
    "prov:used": z.array(ProvEntitySchema),
    "x402:privateContentAvailable": z.boolean(),
    "x402:privateAccessFee": z.string(),
    datePublished: z.string().datetime(),
    dateModified: z.string().datetime().optional(),
  })
  .describe("Public part of bias report (free to read) - JSON-LD compliant");

const ClaimSchema = z.object({
  "@type": z.literal("Claim"),
  text: z.string(),
  isPartOf: z.object({
    name: z.string(),
  }),
});

const CitationCredibilitySchema = z.object({
  "@type": z.literal("PropertyValue"),
  propertyID: z.literal("credibilityTier"),
  value: CredibilityTierEnum,
});

const CitationSchema = z.object({
  "@type": z.enum(["ScholarlyArticle", "WebPage"]),
  name: z.string(),
  url: z.string(),
  author: z.string().optional(),
  abstract: z.string().optional(),
  citation: z.number().int().nonnegative().optional(),
  additionalProperty: CitationCredibilitySchema.optional(),
});

const ClaimProvenanceSchema = z.object({
  "@type": z.literal("prov:Activity"),
  "prov:used": z.array(z.string()),
});

const ClaimReviewSchema = z.object({
  "@type": z.literal("ClaimReview"),
  claimReviewed: z.string(),
  reviewBody: z.string(),
  reviewRating: RatingSchema,
  itemReviewed: ClaimSchema,
  citation: z.array(CitationSchema),
  reviewAspect: z.enum([
    "factualError",
    "missingContext",
    "sourceProblem",
    "mediaIssue",
  ]),
  "prov:wasGeneratedBy": ClaimProvenanceSchema,
});

const PrivateBiasReportSchema = z
  .object({
    "@context": JsonLdContextSchema,
    "@id": z.string().nullable(),
    hasPart: z.array(ClaimReviewSchema),
  })
  .describe("Private part of bias report (paid access via x402) - detailed claim reviews");

const BiasReportKnowledgeAssetSchema = z
  .object({
    public: PublicBiasReportSchema,
    private: PrivateBiasReportSchema,
  })
  .describe("Combined public/private bias report for DKG publishing");

const TextSimilaritySchema = z
  .object({
    semanticSimilarity: z
      .number()
      .min(0)
      .max(1)
      .describe("Semantic similarity computed from cosine similarity of embeddings (0.0-1.0)"),
    structuralSimilarity: z
      .number()
      .min(0)
      .max(1)
      .describe("Structural similarity of sections and organization (0.0-1.0). LLM fills this."),
    lengthRatio: z
      .number()
      .min(0)
      .describe(
        "Ratio of Grokipedia length to Wikipedia length (e.g., 1.5 means Grokipedia is 50% longer). Computed by system."
      ),
  })
  .required()
  .describe("Detailed text similarity metrics");

const FullContentSimilaritySchema = z
  .object({
    overallAlignment: z
      .number()
      .min(0)
      .max(1)
      .describe("Overall alignment score (0.0=completely different, 1.0=identical)"),
    alignmentDescription: z
      .string()
      .describe(
        "Human-readable alignment level: 'High alignment', 'Moderate alignment', 'Low alignment', 'No alignment'"
      ),
    textSimilarity: TextSimilaritySchema,
    interpretation: z
      .string()
      .describe(
        "Interpretation of what similarity scores mean and whether divergence is concerning"
      ),
  })
  .required()
  .describe("Content similarity analysis comparing Grokipedia to Wikipedia baseline");

const ProvenanceSchema = z
  .object({
    creator: z
      .string()
      .describe(
        "Name/identifier of the system that created this report (e.g., 'ConsensusLens Bias Detection Agent v2.0')"
      ),
    verificationMethod: z
      .string()
      .describe(
        "Brief methodology description (e.g., 'Systematic claim extraction, Wikipedia comparison, peer-reviewed literature review')"
      ),
    toolsUsed: z
      .array(z.string())
      .describe(
        "List of verification tools used (e.g., ['google_scholar_search', 'web_search'])"
      ),
    sourceVersions: SourceVersionSchema.optional().describe(
      "Versions of source articles analyzed."
    ),
    paranetId: z
      .string()
      .optional()
      .describe(
        "OriginTrail Paranet identifier where report is stored (filled by publishing system)"
      ),
  })
  .describe("Provenance tracking how report was created and where it's stored on DKG");

const BiasDetectionReportSchema = z
  .object({
    "@context": LLMContextSchema,
    "@type": z
      .literal("BiasDetectionReport")
      .describe("JSON-LD type identifier for this report"),
    noteType: z
      .enum(["public", "private"])
      .optional()
      .describe(
        "Publisher decision: 'public' = visible to all on DKG, 'private' = restricted access. NOT filled by LLM."
      ),
    articleTitle: z.string().describe("Title of the article being analyzed"),
    grokipediaUrl: z.string().describe("Full URL to the Grokipedia article"),
    wikipediaUrl: z.string().describe("Full URL to the Wikipedia article for comparison"),
    analysisDate: z
      .string()
      .datetime()
      .describe("ISO 8601 datetime when this analysis was performed"),
    executiveSummary: ExecutiveSummarySchema,
    factualErrors: z
      .array(FactualErrorSchema)
      .describe(
        "All factual errors: hallucinations (fabricated information) and false claims (inaccurate or misrepresented information). Both require peer-reviewed sources for scientific claims."
      ),
    missingContext: z
      .array(MissingContextSchema)
      .describe(
        "Missing context issues: significant omissions (important information left out) and cherry-picking (selective presentation creating misleading impression)."
      ),
    sourceProblems: z
      .array(SourceProblemSchema)
      .describe("Unreliable or low-quality sources used by Grokipedia"),
    mediaIssues: z
      .array(MediaIssueSchema)
      .describe(
        "Image, video, or audio problems: manipulation, misattribution, misleading context, or fabrication"
      ),
    overallAssessment: OverallAssessmentSchema,
    contentSimilarity: FullContentSimilaritySchema,
    provenance: ProvenanceSchema,
  })
  .describe(
    "Complete bias detection report for OriginTrail DKG Knowledge Assets: compares Grokipedia vs Wikipedia to identify factual errors, missing context, source problems, and media issues"
  );

export type LLMResponse = z.infer<typeof LLMResponseSchema>;
export type BiasDetectionReport = z.infer<typeof BiasDetectionReportSchema>;
export type SourceVersions = z.infer<typeof SourceVersionSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type PublicBiasReport = z.infer<typeof PublicBiasReportSchema>;
export type PrivateBiasReport = z.infer<typeof PrivateBiasReportSchema>;
export type BiasReportKnowledgeAsset = z.infer<typeof BiasReportKnowledgeAssetSchema>;
export type FactualError = z.infer<typeof FactualErrorSchema>;
export type MissingContext = z.infer<typeof MissingContextSchema>;
export type SourceProblem = z.infer<typeof SourceProblemSchema>;
export type MediaIssue = z.infer<typeof MediaIssueSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type BiasLevel = z.infer<typeof BiasLevelEnum>;
export type CredibilityTier = z.infer<typeof CredibilityTierEnum>;

export {
  LLMResponseSchema,
  BiasDetectionReportSchema,
  SourceVersionSchema,
  ProvenanceSchema,
  PublicBiasReportSchema,
  PrivateBiasReportSchema,
  BiasReportKnowledgeAssetSchema,
  FactualErrorSchema,
  MissingContextSchema,
  SourceProblemSchema,
  MediaIssueSchema,
  SourceSchema,
  BiasLevelEnum,
  CredibilityTierEnum,
};

export default LLMResponseSchema;
