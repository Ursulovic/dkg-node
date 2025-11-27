import { traceable } from "langsmith/traceable";

import { createBiasDetectorAgent } from "../agents/bias-detector/agent.js";
import type { BiasReportKnowledgeAsset } from "../agents/bias-detector/schema.js";
import type { LLMResponse } from "../agents/bias-detector/llm-schema.js";
import { WikipediaLoader } from "../loaders/wikipedia.js";
import { GrokipediaLoader } from "../loaders/grokipedia.js";
import { calculateArticleSimilarity } from "../utils/similarity.js";
import { generateSourceVersions } from "../utils/hash.js";
import { createKnowledgeAsset } from "../utils/createKnowledgeAsset.js";
import { CostTracker } from "../utils/costTracker.js";
import { getTracUsdRate } from "../utils/priceManager.js";
import type { AnalysisDepth } from "../types/depth.js";
import { reportStore } from "../store/index.js";

const LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT ?? "plugin-bias-lens";

export async function runBiasDetection(
  grokipediaUrl: string,
  wikipediaUrl: string,
  analysisDepth: AnalysisDepth = "medium"
): Promise<{ id: string; knowledgeAsset: BiasReportKnowledgeAsset }> {
  const costTracker = new CostTracker();

  const tracedDetection = traceable(
    async () => {
      const biasDetectorAgent = createBiasDetectorAgent(analysisDepth, costTracker);

      const [grokipediaDocs, wikipediaDocs] = await Promise.all([
        new GrokipediaLoader().loadPage(grokipediaUrl),
        new WikipediaLoader().loadPage(wikipediaUrl),
      ]);

      const grokipediaPage = grokipediaDocs[0]?.pageContent ?? "";
      const wikipediaPage = wikipediaDocs[0]?.pageContent ?? "";

      const [similarity, sourceVersions] = await Promise.all([
        calculateArticleSimilarity(grokipediaPage, wikipediaPage, costTracker),
        generateSourceVersions(grokipediaUrl, wikipediaUrl),
      ]);

      const userMessage = `Analyze these articles:\nGROKIPEDIA (${grokipediaUrl})\n${grokipediaPage}\n\n---\n\nWIKIPEDIA (${wikipediaUrl})\n${wikipediaPage}`;

      const response = await biasDetectorAgent.invoke(
        {
          messages: [{ role: "user", content: userMessage }],
        },
        {
          recursionLimit: 500,
        }
      );

      const articleTitle =
        grokipediaDocs[0]?.metadata?.title ??
        grokipediaUrl.split("/").pop()?.replace(/_/g, " ") ??
        "Unknown Article";

      const llmResponse = response.structuredResponse as LLMResponse;

      return {
        llmResponse,
        similarity,
        sourceVersions,
        grokipediaUrl,
        wikipediaUrl,
        articleTitle,
      };
    },
    {
      name: "BiasDetection",
      project_name: LANGSMITH_PROJECT,
    }
  );

  const detectionResult = await tracedDetection();
  const costs = costTracker.calculateCosts();

  const knowledgeAsset = await createKnowledgeAsset({
    llmResponse: detectionResult.llmResponse,
    similarity: detectionResult.similarity,
    sourceVersions: detectionResult.sourceVersions,
    grokipediaUrl: detectionResult.grokipediaUrl,
    wikipediaUrl: detectionResult.wikipediaUrl,
    articleTitle: detectionResult.articleTitle,
    metrics: {
      tokenUsage: costs.totalTokens,
      costUSD: costs.totalUSD,
    },
  });

  const reportId = knowledgeAsset.public["@id"];

  const tracUsdRate = await getTracUsdRate();
  const costTrac = costs.totalUSD / tracUsdRate;
  const privateAccessFee = costTrac * 2.0;

  await reportStore.save(knowledgeAsset, {
    id: reportId,
    grokipediaUrl: detectionResult.grokipediaUrl,
    wikipediaUrl: detectionResult.wikipediaUrl,
    title: detectionResult.articleTitle,
    biasLevel: detectionResult.llmResponse.summary.biasLevel,
    analysisDepth,
    costUsd: costs.totalUSD,
    costTrac,
    privateAccessFee,
  });

  return { id: reportId, knowledgeAsset };
}
