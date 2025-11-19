import { z } from "zod";

/**
 * Optimized BiasDetectionReport Schema v2.0
 *
 * Designed for OriginTrail DKG Knowledge Assets
 * Streamlined for LLM generation with clear separation of concerns:
 * - LLM fills: All bias detection findings and analysis
 * - Publisher fills: noteType, sourceVersions
 * - System fills: Provenance metadata (paranetId, blockchainAnchor)
 */

const SourceSchema = z.object({
  name: z
    .string()
    .describe("Name of the authoritative source used to verify this claim"),
  url: z.string().url().describe("URL to the authoritative source"),
  credibilityTier: z
    .enum([
      "peer-reviewed",
      "systematic-review",
      "government",
      "academic-institution",
      "major-news-outlet",
      "think-tank",
      "blog-opinion",
    ])
    .describe(
      "Evidence hierarchy tier: peer-reviewed > systematic-review > government > academic-institution > major-news-outlet > think-tank > blog-opinion",
    ),
});

const FindingSchema = z.object({
  claim: z.string().describe("The exact claim from Grokipedia being evaluated"),
  issue: z
    .string()
    .describe(
      "Explanation of the problem: what is false, misleading, missing, or cherry-picked",
    ),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Confidence level (0.0-1.0) based on source quality: 0.85-1.0=peer-reviewed, 0.6-0.85=government/news, 0.3-0.6=blog/opinion, 0.0-0.3=contradicted",
    ),
  sources: z
    .array(SourceSchema)
    .min(1)
    .describe(
      "Array of authoritative sources supporting this finding. Multiple sources strengthen verification.",
    ),
  toolUsed: z
    .enum(["google_scholar_search", "web_search", "both"])
    .describe(
      "Which verification tool was used: google_scholar_search for scientific claims, web_search for news/events, both for controversial topics",
    ),
  section: z
    .string()
    .describe(
      "Section name in the Grokipedia article where this issue appears",
    ),
});

const MediaIssueSchema = z.object({
  mediaType: z
    .enum(["image", "video", "audio"])
    .describe("Type of media content"),
  description: z
    .string()
    .describe("Description of the media element in Grokipedia"),
  issue: z
    .string()
    .describe(
      "Problem identified: manipulation, misattribution, misleading caption, missing context, or fabrication",
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
      "Sources verifying the media issue (original source, fact-check, forensic analysis)",
    ),
  section: z.string().describe("Section name where this media appears"),
});

const BiasDetectionReportSchema = z
  .object({
    "@context": z
      .object({
        "@vocab": z
          .string()
          .default("https://schema.org/")
          .describe("Base vocabulary URL for the ontology"),
        bias: z
          .string()
          .default("https://grokipedia.com/ontology/bias/")
          .describe("Bias ontology namespace URL"),
        schema: z
          .string()
          .default("https://schema.org/")
          .describe("Schema.org namespace URL"),
        grokipedia: z.string().optional().describe("Grokipedia base URL"),
        wikipedia: z.string().optional().describe("Wikipedia base URL"),
      })
      .describe("JSON-LD context defining namespaces and vocabularies"),

    "@type": z
      .literal("BiasDetectionReport")
      .describe("JSON-LD type identifier for this report"),

    // ============================================
    // PUBLISHER-FILLED FIELDS (not LLM)
    // ============================================
    noteType: z
      .enum(["public", "private"])
      .optional()
      .describe(
        "Publisher decision: 'public' = visible to all on DKG, 'private' = restricted access. NOT filled by LLM.",
      ),

    // ============================================
    // CORE METADATA (LLM fills these)
    // ============================================
    articleTitle: z.string().describe("Title of the article being analyzed"),
    grokipediaUrl: z
      .string()
      .url()
      .describe("Full URL to the Grokipedia article"),
    wikipediaUrl: z
      .string()
      .url()
      .describe("Full URL to the Wikipedia article for comparison"),
    analysisDate: z
      .string()
      .datetime()
      .describe("ISO 8601 datetime when this analysis was performed"),

    // ============================================
    // EXECUTIVE SUMMARY (LLM fills)
    // ============================================
    executiveSummary: z
      .object({
        overview: z
          .string()
          .describe(
            "High-level summary of bias analysis findings (2-3 sentences)",
          ),
        biasLevel: z
          .enum(["none", "low", "moderate", "high", "severe"])
          .describe(
            "Overall bias severity: none=aligned with Wikipedia, low=minor issues, moderate=notable problems, high=serious bias, severe=extensive misinformation",
          ),
        keyPatterns: z
          .array(z.string())
          .describe(
            "Major patterns of bias detected (e.g., 'Cherry-picking statistics', 'Omission of scientific consensus')",
          ),
      })
      .describe("Executive summary providing quick assessment of bias"),

    // ============================================
    // FACTUAL ERRORS (LLM fills)
    // Merged: hallucinations + false claims
    // ============================================
    factualErrors: z
      .array(FindingSchema)
      .describe(
        "All factual errors: hallucinations (fabricated information) and false claims (inaccurate or misrepresented information). Both require peer-reviewed sources for scientific claims.",
      ),

    // ============================================
    // MISSING CONTEXT (LLM fills)
    // Merged: omissions + cherry-picking
    // ============================================
    missingContext: z
      .array(FindingSchema)
      .describe(
        "Missing context issues: significant omissions (important information left out) and cherry-picking (selective presentation creating misleading impression).",
      ),

    // ============================================
    // SOURCE PROBLEMS (LLM fills)
    // ============================================
    sourceProblems: z
      .array(
        z.object({
          sourceName: z
            .string()
            .describe("Name of the unreliable source used by Grokipedia"),
          issue: z
            .string()
            .describe(
              "Why this source is problematic: low credibility, bias, conflicts of interest, no editorial standards",
            ),
          confidence: z
            .number()
            .min(0)
            .max(1)
            .describe("Confidence that this source is unreliable (0.0-1.0)"),
          evidenceSources: z
            .array(SourceSchema)
            .min(1)
            .describe(
              "Authoritative sources documenting this source's unreliability",
            ),
          section: z
            .string()
            .describe("Section in Grokipedia that relies on this source"),
        }),
      )
      .describe("Unreliable or low-quality sources used by Grokipedia"),

    // ============================================
    // MEDIA VERIFICATION (LLM fills)
    // NEW: Required by system prompt STEP 7
    // ============================================
    mediaIssues: z
      .array(MediaIssueSchema)
      .describe(
        "Image, video, or audio problems: manipulation, misattribution, misleading context, or fabrication",
      ),

    // ============================================
    // SECTION ANALYSIS (LLM fills)
    // Enhanced: Links verified claims AND problems
    // ============================================
    sectionAnalysis: z
      .array(
        z.object({
          sectionName: z
            .string()
            .describe("Section name in Grokipedia article"),
          verifiedClaims: z
            .array(z.string())
            .describe("Claims verified as accurate in this section"),
          issueCount: z
            .object({
              factualErrors: z
                .number()
                .int()
                .nonnegative()
                .describe("Number of factual errors in this section"),
              missingContext: z
                .number()
                .int()
                .nonnegative()
                .describe("Number of context issues in this section"),
              sourceProblems: z
                .number()
                .int()
                .nonnegative()
                .describe("Number of source problems in this section"),
              mediaIssues: z
                .number()
                .int()
                .nonnegative()
                .describe("Number of media issues in this section"),
            })
            .describe("Count of each issue type in this section"),
        }),
      )
      .describe(
        "Section-by-section breakdown linking verified claims and problems to specific article sections",
      ),

    // ============================================
    // OVERALL ASSESSMENT (LLM fills)
    // ============================================
    overallAssessment: z
      .object({
        overallBiasConfidence: z
          .number()
          .min(0)
          .max(1)
          .describe(
            "Overall confidence that significant bias exists (0.0=no bias, 1.0=extreme bias confirmed)",
          ),
        totalFactualErrors: z
          .number()
          .int()
          .nonnegative()
          .describe(
            "Total count of factual errors (hallucinations + false claims)",
          ),
        totalMissingContext: z
          .number()
          .int()
          .nonnegative()
          .describe(
            "Total count of missing context issues (omissions + cherry-picking)",
          ),
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
      .describe("Overall assessment with aggregate statistics"),

    // ============================================
    // CONTENT SIMILARITY (LLM fills)
    // Required by hackathon challenge objective 2
    // ============================================
    contentSimilarity: z
      .object({
        overallAlignment: z
          .number()
          .min(0)
          .max(1)
          .describe(
            "Overall alignment score (0.0=completely different, 1.0=identical)",
          ),
        alignmentDescription: z
          .string()
          .describe(
            "Human-readable alignment level: 'High alignment', 'Moderate alignment', 'Low alignment', 'No alignment'",
          ),
        textSimilarity: z
          .object({
            semanticSimilarity: z
              .number()
              .min(0)
              .max(1)
              .describe(
                "Semantic similarity of meaning and content (0.0-1.0). LLM fills this based on analysis.",
              ),
            structuralSimilarity: z
              .number()
              .min(0)
              .max(1)
              .describe(
                "Structural similarity of sections and organization (0.0-1.0). LLM fills this.",
              ),
            lengthRatio: z
              .number()
              .min(0)
              .describe(
                "Ratio of Grokipedia length to Wikipedia length (e.g., 1.5 means Grokipedia is 50% longer). LLM calculates this.",
              ),
            nGramOverlap: z
              .number()
              .min(0)
              .max(1)
              .optional()
              .describe(
                "N-gram overlap measuring exact phrase matches (0.0-1.0). OPTIONAL: Only filled if system provides utility for cosine similarity calculation.",
              ),
          })
          .describe("Detailed text similarity metrics"),
        interpretation: z
          .string()
          .describe(
            "Interpretation of what similarity scores mean and whether divergence is concerning",
          ),
      })
      .describe(
        "Content similarity analysis comparing Grokipedia to Wikipedia baseline (required by hackathon challenge)",
      ),

    // ============================================
    // PROVENANCE (System/Publisher fills)
    // ============================================
    provenance: z
      .object({
        creator: z
          .string()
          .describe(
            "Name/identifier of the system that created this report (e.g., 'ConsensusLens Bias Detection Agent v2.0')",
          ),
        verificationMethod: z
          .string()
          .describe(
            "Brief methodology description (e.g., 'Systematic claim extraction, Wikipedia comparison, peer-reviewed literature review')",
          ),
        toolsUsed: z
          .array(z.string())
          .describe(
            "List of verification tools used (e.g., ['google_scholar_search', 'web_search'])",
          ),
        sourceVersions: z
          .object({
            grokipedia: z
              .object({
                url: z.string().url(),
                accessedAt: z.string().datetime(),
                contentHash: z
                  .string()
                  .optional()
                  .describe("SHA-256 hash of page content for verification"),
                lastModified: z
                  .string()
                  .datetime()
                  .optional()
                  .describe("Last modified timestamp if available"),
              })
              .describe("Grokipedia source version metadata"),
            wikipedia: z
              .object({
                url: z.string().url(),
                accessedAt: z.string().datetime(),
                revisionId: z
                  .string()
                  .optional()
                  .describe("Wikipedia revision ID for exact version tracking"),
                contentHash: z
                  .string()
                  .optional()
                  .describe("SHA-256 hash of page content for verification"),
                lastModified: z
                  .string()
                  .datetime()
                  .optional()
                  .describe("Last modified timestamp if available"),
              })
              .describe("Wikipedia source version metadata"),
          })
          .optional()
          .describe(
            "Versions of source articles analyzed. SYSTEM PRECALCULATES THIS, NOT LLM.",
          ),
        paranetId: z
          .string()
          .optional()
          .describe(
            "OriginTrail Paranet identifier where report is stored (filled by publishing system)",
          ),
        blockchainAnchor: z
          .string()
          .optional()
          .describe(
            "Blockchain transaction hash proving integrity and timestamp (filled by publishing system)",
          ),
      })
      .describe(
        "Provenance tracking how report was created and where it's stored on DKG",
      ),
  })
  .describe(
    "Optimized bias detection report for OriginTrail DKG Knowledge Assets: compares Grokipedia vs Wikipedia to identify factual errors, missing context, source problems, and media issues",
  );

export type BiasDetectionReport = z.infer<typeof BiasDetectionReportSchema>;

export default BiasDetectionReportSchema;
