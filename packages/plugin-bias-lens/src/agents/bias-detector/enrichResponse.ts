import { randomUUID } from "node:crypto";
import type {
  LLMResponse,
  LLMError,
  BiasDetectionReport,
  SourceVersions,
  FactualError,
  MissingContext,
  SourceProblem,
  MediaIssue,
} from "./schema.js";
import type { SimilarityResult } from "../../utils/similarity.js";

interface EnrichResponseInput {
  llmResponse: LLMResponse;
  similarity: SimilarityResult;
  sourceVersions: SourceVersions;
  grokipediaUrl: string;
  wikipediaUrl: string;
  articleTitle: string;
}

function calculateOverallConfidence(errors: LLMError[]): number {
  if (errors.length === 0) return 0;

  const totalConfidence = errors.reduce(
    (sum, error) => sum + error.confidence,
    0,
  );
  const avgConfidence = totalConfidence / errors.length;

  const errorCountFactor = Math.min(errors.length / 10, 1);
  return Math.min(avgConfidence * (0.5 + 0.5 * errorCountFactor), 1);
}

function extractFactualErrors(errors: LLMError[]): FactualError[] {
  return errors
    .filter((e) => e.type === "factualError")
    .map(({ type, sourceName, mediaType, ...rest }) => rest);
}

function extractMissingContext(errors: LLMError[]): MissingContext[] {
  return errors
    .filter((e) => e.type === "missingContext")
    .map(({ type, sourceName, mediaType, ...rest }) => rest);
}

function extractSourceProblems(errors: LLMError[]): SourceProblem[] {
  return errors
    .filter((e) => e.type === "sourceProblem")
    .map((e) => ({
      sourceName: e.sourceName ?? e.claim,
      issue: e.issue,
      confidence: e.confidence,
      evidenceSources: e.sources,
      toolsUsed: e.toolsUsed,
      section: e.section,
    }));
}

function extractMediaIssues(errors: LLMError[]): MediaIssue[] {
  return errors
    .filter((e) => e.type === "mediaIssue")
    .map((e) => ({
      mediaType: e.mediaType ?? "image",
      description: e.claim,
      issue: e.issue,
      confidence: e.confidence,
      sources: e.sources,
      toolsUsed: e.toolsUsed,
      section: e.section,
    }));
}

export function enrichResponse(
  input: EnrichResponseInput,
): BiasDetectionReport {
  const {
    llmResponse,
    similarity,
    sourceVersions,
    grokipediaUrl,
    wikipediaUrl,
    articleTitle,
  } = input;

  const reportId = randomUUID();
  const reportIri = `https://bias-lens.neuroweb.ai/report/${reportId}`;

  const factualErrors = extractFactualErrors(llmResponse.errors);
  const missingContext = extractMissingContext(llmResponse.errors);
  const sourceProblems = extractSourceProblems(llmResponse.errors);
  const mediaIssues = extractMediaIssues(llmResponse.errors);

  const overallAssessment = {
    totalFactualErrors: factualErrors.length,
    totalMissingContext: missingContext.length,
    totalSourceProblems: sourceProblems.length,
    totalMediaIssues: mediaIssues.length,
    overallBiasConfidence: calculateOverallConfidence(llmResponse.errors),
  };

  return {
    "@context": {
      "@vocab": "https://schema.org/",
      prov: "http://www.w3.org/ns/prov#",
    },
    "@id": reportIri,
    "@type": "BiasDetectionReport",
    articleTitle,
    grokipediaUrl,
    wikipediaUrl,
    analysisDate: new Date().toISOString(),
    executiveSummary: {
      overview: llmResponse.summary.overview,
      biasLevel: llmResponse.summary.biasLevel,
      keyPatterns: llmResponse.summary.keyPatterns,
    },
    factualErrors,
    missingContext,
    sourceProblems,
    mediaIssues,
    overallAssessment,
    contentSimilarity: {
      overallAlignment: llmResponse.contentSimilarity.overallAlignment,
      alignmentDescription: llmResponse.contentSimilarity.alignmentDescription,
      textSimilarity: {
        semanticSimilarity: similarity.cosineSimilarity,
        structuralSimilarity:
          llmResponse.contentSimilarity.structuralSimilarity,
        lengthRatio: similarity.lengthRatio,
      },
      interpretation: llmResponse.contentSimilarity.interpretation,
    },
    provenance: {
      creator: "ConsensusLens Bias Detection Agent v2.0",
      verificationMethod:
        "Systematic claim extraction, Wikipedia comparison, peer-reviewed literature review via Google Scholar, web search verification",
      toolsUsed: ["google_scholar_search", "web_search", "wikipedia_query"],
      sourceVersions,
    },
  };
}
