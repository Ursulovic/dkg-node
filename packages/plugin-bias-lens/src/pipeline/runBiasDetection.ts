import { traceable } from "langsmith/traceable";

import { createBiasDetectorAgent } from "../agents/bias-detector/agent.js";
import {
  type BiasReportKnowledgeAsset,
  type LLMResponse,
} from "../agents/bias-detector/schema.js";
import { enrichResponse } from "../agents/bias-detector/enrichResponse.js";
import { WikipediaLoader } from "../loaders/wikipedia.js";
import { GrokipediaLoader } from "../loaders/grokipedia.js";
import { calculateArticleSimilarity } from "../utils/similarity.js";
import { generateSourceVersions } from "../utils/hash.js";
import { formatAsJsonLd } from "../utils/jsonldFormatter.js";
import { CostTracker } from "../utils/costTracker.js";
import type { AnalysisDepth } from "../types/depth.js";

const LANGSMITH_PROJECT = process.env.LANGSMITH_PROJECT ?? "plugin-bias-lens";

export async function runBiasDetection(
  grokipediaUrl: string,
  wikipediaUrl: string,
  analysisDepth: AnalysisDepth = "medium"
): Promise<BiasReportKnowledgeAsset> {
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

      const intermediateReport = enrichResponse({
        llmResponse: response.structuredResponse as LLMResponse,
        similarity,
        sourceVersions,
        grokipediaUrl,
        wikipediaUrl,
        articleTitle,
      });

      return intermediateReport;
    },
    {
      name: "BiasDetection",
      project_name: LANGSMITH_PROJECT,
    }
  );

  const intermediateReport = await tracedDetection();
  const costs = costTracker.calculateCosts();
  const knowledgeAsset = await formatAsJsonLd(intermediateReport, {
    tokenUsage: costs.totalTokens,
    costUSD: costs.totalUSD,
  });

  return knowledgeAsset;
}
