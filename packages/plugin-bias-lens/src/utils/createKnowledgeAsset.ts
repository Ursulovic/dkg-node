import { randomUUID } from "node:crypto";
import type {
  LLMResponse,
  LLMClaimReview,
  BiasLevel,
} from "../agents/bias-detector/llm-schema.js";
import type {
  BiasReportKnowledgeAsset,
  PublicBiasReport,
  PrivateBiasReport,
  SourceVersions,
  PrivateClaimReview,
  Rating,
} from "../agents/bias-detector/schema.js";
import type { SimilarityResult } from "./similarity.js";
import { getTracUsdRate } from "./priceManager.js";

interface AnalysisMetrics {
  tokenUsage: number;
  costUSD: number;
  traceId?: string;
}

interface CreateKnowledgeAssetInput {
  llmResponse: LLMResponse;
  similarity: SimilarityResult;
  sourceVersions: SourceVersions;
  grokipediaUrl: string;
  wikipediaUrl: string;
  articleTitle: string;
  metrics?: AnalysisMetrics;
}

interface CreateKnowledgeAssetConfig {
  publisherName: string;
  publisherUrl: string;
  agentVersion: string;
  readCostMultiplier: number;
}

function getConfig(): CreateKnowledgeAssetConfig {
  return {
    publisherName: process.env.PUBLISHER_NAME ?? "BiasLens",
    publisherUrl: process.env.BIASLENS_APP_URL ?? "https://biaslens.ai",
    agentVersion: process.env.AGENT_VERSION ?? "2.0",
    readCostMultiplier: Number(process.env.READ_COST_MULTIPLIER) || 2.0,
  };
}

const biasLevelToRating: Record<BiasLevel, 1 | 2 | 3 | 4 | 5> = {
  none: 5,
  low: 4,
  moderate: 3,
  high: 2,
  severe: 1,
};

const biasLevelDescriptions: Record<BiasLevel, string> = {
  none: "No significant bias detected - article aligns with Wikipedia baseline",
  low: "Minor bias issues detected - mostly accurate with small discrepancies",
  moderate: "Notable bias detected - several issues requiring attention",
  high: "Significant bias detected - serious accuracy concerns",
  severe: "Extreme bias detected - extensive misinformation present",
};

function mapLLMClaimReviewToPrivate(
  claimReview: LLMClaimReview,
): PrivateClaimReview {
  return {
    "@type": "ClaimReview",
    claimReviewed: claimReview.claimReviewed,
    reviewBody: claimReview.reviewBody,
    reviewRating: {
      "@type": "Rating",
      ratingValue: claimReview.reviewRating.ratingValue,
      bestRating: 5,
      worstRating: 1,
      ratingExplanation: claimReview.reviewRating.ratingExplanation,
    },
    itemReviewed: {
      "@type": "Claim",
      text: claimReview.itemReviewed.text,
    },
    isPartOf: {
      "@type": "Article",
      articleSection: claimReview.articleSection,
    },
    citation: claimReview.citation.map((c) => ({
      "@type": c.type,
      name: c.name,
      url: c.url,
      ...(c.author && { author: c.author }),
      ...(c.abstract && { abstract: c.abstract }),
      ...(c.citationCount && { citation: c.citationCount }),
    })),
    reviewAspect: claimReview.reviewAspect,
  };
}

export async function createKnowledgeAsset(
  input: CreateKnowledgeAssetInput,
): Promise<BiasReportKnowledgeAsset> {
  const config = getConfig();
  const reportId = randomUUID();
  const reportIri = `urn:dkg:bias-report:${reportId}`;
  const datePublished = new Date().toISOString();

  const {
    llmResponse,
    similarity,
    sourceVersions,
    grokipediaUrl,
    wikipediaUrl,
    articleTitle,
    metrics,
  } = input;

  const costUSD = (metrics?.costUSD ?? 0) * config.readCostMultiplier;

  const biasRating: Rating = {
    "@type": "Rating",
    ratingValue: biasLevelToRating[llmResponse.summary.biasLevel],
    bestRating: 5,
    worstRating: 1,
    ratingExplanation: biasLevelDescriptions[llmResponse.summary.biasLevel],
  };

  const publicReport: PublicBiasReport = {
    "@context": "https://schema.org/",
    "@type": "ClaimReview",
    "@id": reportIri,
    name: `Bias Analysis: ${articleTitle}`,
    itemReviewed: {
      "@type": "Article",
      url: grokipediaUrl,
      name: articleTitle,
    },
    isBasedOn: {
      "@type": "Article",
      url: wikipediaUrl,
      ...(sourceVersions.wikipedia.revisionId && {
        identifier: `revision:${sourceVersions.wikipedia.revisionId}`,
      }),
    },
    reviewBody: llmResponse.summary.overview,
    reviewRating: biasRating,
    keywords: llmResponse.summary.keyPatterns,
    about: {
      "@type": "Thing",
      name: articleTitle,
    },
    negativeNotes: {
      "@type": "ItemList",
      numberOfItems: llmResponse.claimReviews.length,
      description: llmResponse.summary.negativeNotesDescription,
    },
    publisher: {
      "@type": "Organization",
      name: config.publisherName,
      url: config.publisherUrl,
    },
    creator: {
      "@type": "SoftwareApplication",
      name: `${config.publisherName} Detection Agent`,
      softwareVersion: config.agentVersion,
    },
    datePublished,
    license: "https://creativecommons.org/licenses/by-nc/4.0/",
    offers: {
      "@type": "Offer",
      name: "Access Report Details",
      description:
        "One-time access to detailed bias findings, evidence citations, and similarity analysis",
      price: costUSD,
      priceCurrency: "USDC",
      url: `${config.publisherUrl}/report/${reportId}/purchase`,
    },
  };

  const overallAlignmentPercent = Math.round(
    llmResponse.similarity.overallAlignment * 100,
  );
  const semanticPercent = Math.round(similarity.cosineSimilarity * 100);
  const structuralPercent = Math.round(
    llmResponse.similarity.structuralSimilarity * 100,
  );
  const lengthRatioScaled = Math.round(similarity.lengthRatio * 100);

  const privateReport: PrivateBiasReport = {
    "@context": "https://schema.org/",
    "@id": reportIri,
    review: {
      "@type": "Review",
      reviewAspect: "contentSimilarity",
      reviewBody: llmResponse.similarity.interpretation,
      reviewRating: {
        "@type": "Rating",
        ratingValue: overallAlignmentPercent,
        bestRating: 100,
        worstRating: 0,
        ratingExplanation: `${overallAlignmentPercent}% overall alignment with Wikipedia baseline`,
      },
      contentRating: [
        {
          "@type": "Rating",
          ratingValue: semanticPercent,
          bestRating: 100,
          worstRating: 0,
          ratingExplanation: "semanticSimilarity",
        },
        {
          "@type": "Rating",
          ratingValue: structuralPercent,
          bestRating: 100,
          worstRating: 0,
          ratingExplanation: "structuralSimilarity",
        },
        {
          "@type": "Rating",
          ratingValue: lengthRatioScaled,
          bestRating: 200,
          worstRating: 50,
          ratingExplanation:
            "lengthRatio (100 = same length, >100 = Grokipedia longer)",
        },
      ],
    },
    hasPart: llmResponse.claimReviews.map(mapLLMClaimReviewToPrivate),
  };

  return {
    public: publicReport,
    private: privateReport,
  };
}

export function setUAL(
  asset: BiasReportKnowledgeAsset,
  ual: string,
): BiasReportKnowledgeAsset {
  return {
    public: { ...asset.public, "@id": ual },
    private: { ...asset.private, "@id": ual },
  };
}

export { getConfig };
export type {
  CreateKnowledgeAssetInput,
  CreateKnowledgeAssetConfig,
  AnalysisMetrics,
};
