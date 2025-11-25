import type {
  LLMResponse,
  BiasDetectionReport,
  SourceVersions,
} from "./schema.js";
import type { SimilarityResult } from "../../utils/similarity.js";

interface AssembleReportInput {
  llmResponse: LLMResponse;
  similarity: SimilarityResult;
  sourceVersions: SourceVersions;
}

export function assembleReport(input: AssembleReportInput): BiasDetectionReport {
  const { llmResponse, similarity, sourceVersions } = input;

  return {
    "@context": llmResponse["@context"],
    "@type": llmResponse["@type"],
    articleTitle: llmResponse.articleTitle,
    grokipediaUrl: llmResponse.grokipediaUrl,
    wikipediaUrl: llmResponse.wikipediaUrl,
    analysisDate: new Date().toISOString(),
    executiveSummary: llmResponse.executiveSummary,
    factualErrors: llmResponse.factualErrors,
    missingContext: llmResponse.missingContext,
    sourceProblems: llmResponse.sourceProblems,
    mediaIssues: llmResponse.mediaIssues,
    overallAssessment: llmResponse.overallAssessment,
    contentSimilarity: {
      overallAlignment: llmResponse.contentSimilarity.overallAlignment,
      alignmentDescription: llmResponse.contentSimilarity.alignmentDescription,
      textSimilarity: {
        semanticSimilarity: similarity.cosineSimilarity,
        structuralSimilarity: llmResponse.contentSimilarity.structuralSimilarity,
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
