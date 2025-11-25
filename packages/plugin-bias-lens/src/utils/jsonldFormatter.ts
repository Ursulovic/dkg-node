import type {
  BiasDetectionReport,
  BiasReportKnowledgeAsset,
  PublicBiasReport,
  PrivateBiasReport,
  FactualError,
  MissingContext,
  SourceProblem,
  MediaIssue,
  Source,
  CredibilityTier,
} from "../agents/bias-detector/schema.js";
import { mapBiasLevelToRating, mapConfidenceToRating } from "./ratingMapper.js";
import { getTracUsdRate } from "./priceManager.js";

interface FormatterConfig {
  publisherName: string;
  publisherWalletAddress: string;
  agentVersion: string;
  readCostMultiplier: number;
  tracUsdRate: number;
}

const DEFAULT_CONFIG: FormatterConfig = {
  publisherName: "ConsensusLens",
  publisherWalletAddress: "0x0000000000000000000000000000000000000000",
  agentVersion: "2.0",
  readCostMultiplier: 2.0,
  tracUsdRate: 0.5,
};

function getConfig(): FormatterConfig {
  return {
    publisherName: process.env.PUBLISHER_NAME ?? DEFAULT_CONFIG.publisherName,
    publisherWalletAddress:
      process.env.PUBLISHER_WALLET_ADDRESS ?? DEFAULT_CONFIG.publisherWalletAddress,
    agentVersion: process.env.AGENT_VERSION ?? DEFAULT_CONFIG.agentVersion,
    readCostMultiplier:
      Number(process.env.READ_COST_MULTIPLIER) || DEFAULT_CONFIG.readCostMultiplier,
    tracUsdRate: Number(process.env.TRAC_USD_RATE) || DEFAULT_CONFIG.tracUsdRate,
  };
}

function createPropertyValue(
  propertyID: string,
  value: number | string | boolean,
  description?: string
): { "@type": "PropertyValue"; propertyID: string; value: number | string | boolean; description?: string } {
  const result: {
    "@type": "PropertyValue";
    propertyID: string;
    value: number | string | boolean;
    description?: string;
  } = {
    "@type": "PropertyValue",
    propertyID,
    value,
  };
  if (description) {
    result.description = description;
  }
  return result;
}

function mapSourceToCitation(source: Source): {
  "@type": "ScholarlyArticle" | "WebPage";
  name: string;
  url: string;
  author?: string;
  abstract?: string;
  citation?: number;
  additionalProperty?: {
    "@type": "PropertyValue";
    propertyID: "credibilityTier";
    value: CredibilityTier;
  };
} {
  const isScholarly =
    source.credibilityTier === "peer-reviewed" ||
    source.credibilityTier === "systematic-review" ||
    source.credibilityTier === "academic-institution";

  const citation: {
    "@type": "ScholarlyArticle" | "WebPage";
    name: string;
    url: string;
    author?: string;
    abstract?: string;
    citation?: number;
    additionalProperty?: {
      "@type": "PropertyValue";
      propertyID: "credibilityTier";
      value: CredibilityTier;
    };
  } = {
    "@type": isScholarly ? "ScholarlyArticle" : "WebPage",
    name: source.name,
    url: source.url,
  };

  if (source.authors) {
    citation.author = source.authors;
  }
  if (source.snippet) {
    citation.abstract = source.snippet;
  }
  if (source.totalCitations !== null && source.totalCitations !== undefined) {
    citation.citation = source.totalCitations;
  }

  citation.additionalProperty = {
    "@type": "PropertyValue",
    propertyID: "credibilityTier",
    value: source.credibilityTier,
  };

  return citation;
}

function convertFactualErrorToClaimReview(error: FactualError) {
  return {
    "@type": "ClaimReview" as const,
    claimReviewed: error.claim,
    reviewBody: error.issue,
    reviewRating: mapConfidenceToRating(error.confidence),
    itemReviewed: {
      "@type": "Claim" as const,
      text: error.claim,
      isPartOf: { name: error.section },
    },
    citation: error.sources.map(mapSourceToCitation),
    reviewAspect: "factualError" as const,
    "prov:wasGeneratedBy": {
      "@type": "prov:Activity" as const,
      "prov:used": error.toolsUsed,
    },
  };
}

function convertMissingContextToClaimReview(context: MissingContext) {
  return {
    "@type": "ClaimReview" as const,
    claimReviewed: context.claim,
    reviewBody: context.issue,
    reviewRating: mapConfidenceToRating(context.confidence),
    itemReviewed: {
      "@type": "Claim" as const,
      text: context.claim,
      isPartOf: { name: context.section },
    },
    citation: context.sources.map(mapSourceToCitation),
    reviewAspect: "missingContext" as const,
    "prov:wasGeneratedBy": {
      "@type": "prov:Activity" as const,
      "prov:used": context.toolsUsed,
    },
  };
}

function convertSourceProblemToClaimReview(problem: SourceProblem) {
  return {
    "@type": "ClaimReview" as const,
    claimReviewed: problem.sourceName,
    reviewBody: problem.issue,
    reviewRating: mapConfidenceToRating(problem.confidence),
    itemReviewed: {
      "@type": "Claim" as const,
      text: `Source used: ${problem.sourceName}`,
      isPartOf: { name: problem.section },
    },
    citation: problem.evidenceSources.map(mapSourceToCitation),
    reviewAspect: "sourceProblem" as const,
    "prov:wasGeneratedBy": {
      "@type": "prov:Activity" as const,
      "prov:used": problem.toolsUsed,
    },
  };
}

function convertMediaIssueToClaimReview(issue: MediaIssue) {
  return {
    "@type": "ClaimReview" as const,
    claimReviewed: issue.description,
    reviewBody: issue.issue,
    reviewRating: mapConfidenceToRating(issue.confidence),
    itemReviewed: {
      "@type": "Claim" as const,
      text: `${issue.mediaType}: ${issue.description}`,
      isPartOf: { name: issue.section },
    },
    citation: issue.sources.map(mapSourceToCitation),
    reviewAspect: "mediaIssue" as const,
    "prov:wasGeneratedBy": {
      "@type": "prov:Activity" as const,
      "prov:used": issue.toolsUsed,
    },
  };
}

function buildNegativeNotesDescription(report: BiasDetectionReport): string {
  const parts: string[] = [];
  const { overallAssessment } = report;

  if (overallAssessment.totalFactualErrors > 0) {
    parts.push(`${overallAssessment.totalFactualErrors} factual error(s)`);
  }
  if (overallAssessment.totalMissingContext > 0) {
    parts.push(`${overallAssessment.totalMissingContext} missing context issue(s)`);
  }
  if (overallAssessment.totalSourceProblems > 0) {
    parts.push(`${overallAssessment.totalSourceProblems} source problem(s)`);
  }
  if (overallAssessment.totalMediaIssues > 0) {
    parts.push(`${overallAssessment.totalMediaIssues} media issue(s)`);
  }

  return parts.length > 0 ? parts.join(", ") : "No issues found";
}

function collectAllToolsUsed(report: BiasDetectionReport): string[] {
  const tools = new Set<string>();

  for (const error of report.factualErrors) {
    for (const tool of error.toolsUsed) {
      tools.add(tool);
    }
  }
  for (const context of report.missingContext) {
    for (const tool of context.toolsUsed) {
      tools.add(tool);
    }
  }
  for (const problem of report.sourceProblems) {
    for (const tool of problem.toolsUsed) {
      tools.add(tool);
    }
  }
  for (const issue of report.mediaIssues) {
    for (const tool of issue.toolsUsed) {
      tools.add(tool);
    }
  }

  if (report.provenance?.toolsUsed) {
    for (const tool of report.provenance.toolsUsed) {
      tools.add(tool);
    }
  }

  return Array.from(tools);
}

interface AnalysisMetrics {
  tokenUsage: number;
  costUSD: number;
  traceId?: string;
}

async function formatAsJsonLd(
  report: BiasDetectionReport,
  metrics?: AnalysisMetrics
): Promise<BiasReportKnowledgeAsset> {
  const config = getConfig();
  const totalIssues =
    report.overallAssessment.totalFactualErrors +
    report.overallAssessment.totalMissingContext +
    report.overallAssessment.totalSourceProblems +
    report.overallAssessment.totalMediaIssues;

  const costUSD = metrics?.costUSD ?? 0;
  const tracUsdRate = await getTracUsdRate();
  const costTRAC = costUSD / tracUsdRate;
  const calculatedReadCost = costTRAC * config.readCostMultiplier;

  const publicReport: PublicBiasReport = {
    "@context": {
      "@vocab": "https://schema.org/",
      prov: "http://www.w3.org/ns/prov#",
    },
    "@type": "Review",
    "@id": report["@id"] ?? null,
    itemReviewed: {
      "@type": "Article",
      url: report.grokipediaUrl,
      name: report.articleTitle,
    },
    isBasedOn: {
      "@type": "Article",
      url: report.wikipediaUrl,
    },
    publisher: {
      "@type": "Organization",
      name: config.publisherName,
      additionalProperty: [
        createPropertyValue("walletAddress", config.publisherWalletAddress),
        createPropertyValue("paymentNetwork", "otp:20430"),
        createPropertyValue("paymentToken", "TRAC"),
      ],
    },
    reviewRating: mapBiasLevelToRating(report.executiveSummary.biasLevel),
    reviewBody: report.executiveSummary.overview,
    keywords: report.executiveSummary.keyPatterns,
    negativeNotes: {
      "@type": "ItemList",
      numberOfItems: totalIssues,
      description: buildNegativeNotesDescription(report),
    },
    additionalProperty: [
      createPropertyValue(
        "semanticSimilarity",
        report.contentSimilarity.textSimilarity.semanticSimilarity,
        "Semantic similarity from embedding cosine similarity"
      ),
      createPropertyValue(
        "structuralSimilarity",
        report.contentSimilarity.textSimilarity.structuralSimilarity,
        "Structural similarity of sections and organization"
      ),
      createPropertyValue(
        "lengthRatio",
        report.contentSimilarity.textSimilarity.lengthRatio,
        "Ratio of Grokipedia to Wikipedia length"
      ),
      createPropertyValue(
        "overallAlignment",
        report.contentSimilarity.overallAlignment,
        report.contentSimilarity.alignmentDescription
      ),
      createPropertyValue(
        "alignmentInterpretation",
        report.contentSimilarity.interpretation
      ),
      createPropertyValue("totalFactualErrors", report.overallAssessment.totalFactualErrors),
      createPropertyValue("totalMissingContext", report.overallAssessment.totalMissingContext),
      createPropertyValue("totalSourceProblems", report.overallAssessment.totalSourceProblems),
      createPropertyValue("totalMediaIssues", report.overallAssessment.totalMediaIssues),
      createPropertyValue(
        "overallBiasConfidence",
        report.overallAssessment.overallBiasConfidence,
        "Confidence that significant bias exists (0-1)"
      ),
      createPropertyValue("tokenUsage", metrics?.tokenUsage ?? 0),
      createPropertyValue("costUSD", costUSD),
      createPropertyValue("tracUsdRate", tracUsdRate, "TRAC/USD exchange rate used"),
      createPropertyValue("costTRAC", costTRAC),
      createPropertyValue("readCostMultiplier", config.readCostMultiplier),
      createPropertyValue("calculatedReadCost", calculatedReadCost),
      createPropertyValue("privateContentAvailable", totalIssues > 0),
      createPropertyValue("privateAccessFee", calculatedReadCost),
      createPropertyValue("privateAccessFeeToken", "TRAC"),
      ...(metrics?.traceId ? [createPropertyValue("traceId", metrics.traceId)] : []),
    ],
    "prov:wasGeneratedBy": {
      "@type": "prov:Activity",
      "prov:wasAssociatedWith": {
        "@type": "SoftwareApplication",
        name: "ConsensusLens Bias Detection Agent",
        softwareVersion: config.agentVersion,
      },
      "prov:used": collectAllToolsUsed(report),
      description: report.provenance?.verificationMethod,
    },
    "prov:used": buildProvUsed(report),
    datePublished: report.analysisDate,
  };

  const privateReport: PrivateBiasReport = {
    "@context": {
      "@vocab": "https://schema.org/",
      prov: "http://www.w3.org/ns/prov#",
    },
    "@id": report["@id"] ?? null,
    hasPart: [
      ...report.factualErrors.map(convertFactualErrorToClaimReview),
      ...report.missingContext.map(convertMissingContextToClaimReview),
      ...report.sourceProblems.map(convertSourceProblemToClaimReview),
      ...report.mediaIssues.map(convertMediaIssueToClaimReview),
    ],
  };

  return {
    public: publicReport,
    private: privateReport,
  };
}

function buildProvUsed(
  report: BiasDetectionReport
): Array<{
  "@type": "prov:Entity";
  "@id": string;
  "prov:generatedAtTime": string;
  identifier?: string;
}> {
  const entities: Array<{
    "@type": "prov:Entity";
    "@id": string;
    "prov:generatedAtTime": string;
    identifier?: string;
  }> = [];

  const sourceVersions = report.provenance?.sourceVersions;
  if (sourceVersions) {
    entities.push({
      "@type": "prov:Entity",
      "@id": sourceVersions.grokipedia.url,
      "prov:generatedAtTime": sourceVersions.grokipedia.accessedAt,
      identifier: sourceVersions.grokipedia.pageHash,
    });

    const wikipediaEntity: {
      "@type": "prov:Entity";
      "@id": string;
      "prov:generatedAtTime": string;
      identifier?: string;
    } = {
      "@type": "prov:Entity",
      "@id": sourceVersions.wikipedia.url,
      "prov:generatedAtTime": sourceVersions.wikipedia.accessedAt,
    };

    if (sourceVersions.wikipedia.revisionId) {
      wikipediaEntity.identifier = sourceVersions.wikipedia.revisionId;
    } else if (sourceVersions.wikipedia.pageHash) {
      wikipediaEntity.identifier = sourceVersions.wikipedia.pageHash;
    }

    entities.push(wikipediaEntity);
  } else {
    entities.push({
      "@type": "prov:Entity",
      "@id": report.grokipediaUrl,
      "prov:generatedAtTime": report.analysisDate,
    });
    entities.push({
      "@type": "prov:Entity",
      "@id": report.wikipediaUrl,
      "prov:generatedAtTime": report.analysisDate,
    });
  }

  return entities;
}

function setUAL(
  asset: BiasReportKnowledgeAsset,
  ual: string
): BiasReportKnowledgeAsset {
  return {
    public: { ...asset.public, "@id": ual },
    private: { ...asset.private, "@id": ual },
  };
}

export { formatAsJsonLd, setUAL, getConfig };
export type { FormatterConfig, AnalysisMetrics };
