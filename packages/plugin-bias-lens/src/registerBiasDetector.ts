import { type DkgPlugin } from "@dkg/plugins";
import { openAPIRoute, z } from "@dkg/plugin-swagger";

import { createBiasDetectorAgent } from "./agents/bias-detector/agent.js";
import {
  BiasReportKnowledgeAssetSchema,
} from "./agents/bias-detector/schema.js";
import { assembleReport } from "./agents/bias-detector/assembleReport.js";
import { WikipediaLoader } from "./loaders/wikipedia.js";
import { GrokipediaLoader } from "./loaders/grokipedia.js";
import { calculateArticleSimilarity } from "./utils/similarity.js";
import { generateSourceVersions } from "./utils/hash.js";
import { splitReportForDKG } from "./utils/reportSplitter.js";
import type { AnalysisDepth } from "./types/depth.js";

const title = "Detect Bias";
const name = "detect-bias";
const description =
  "Runs a deep analysis of Grokipedia page against given Wikipedia page and produces a JSON-LD compliant bias report knowledge asset. The report is split into public (free summary with ratings and metrics) and private (detailed claim reviews, paid via x402). You will receive this knowledge asset and offer user to save it to DKG using your existing tools. When offering user to save it to DKG you need to ask whether this is a public or private note and all relevant questions needed for saving to DKG operation. Note: You can use this tool directly if user pastes you both urls, also if user pastes just a single grokipedia/wikipedia url call the research-topic topic tool with a query that includes given url.";

const inputSchema = {
  grokipediaUrl: z.string().describe("Grokipedia URL to analyze for bias"),
  wikipediaUrl: z
    .string()
    .describe("Wikipedia URL used as baseline for bias analysis"),
  analysisDepth: z
    .enum(["low", "medium", "high"])
    .default("medium")
    .describe(
      "Analysis depth: low (quick, top 5-10 claims), medium (balanced, top 15-25 claims), high (comprehensive, all claims)"
    ),
};

async function runBiasDetection(
  grokipediaUrl: string,
  wikipediaUrl: string,
  analysisDepth: AnalysisDepth = "medium"
) {
  const biasDetectorAgent = createBiasDetectorAgent(analysisDepth);
  const [grokipediaDocs, wikipediaDocs] = await Promise.all([
    new GrokipediaLoader().loadPage(grokipediaUrl),
    new WikipediaLoader().loadPage(wikipediaUrl),
  ]);

  const grokipediaPage = grokipediaDocs[0]?.pageContent ?? "";
  const wikipediaPage = wikipediaDocs[0]?.pageContent ?? "";

  const [similarity, sourceVersions] = await Promise.all([
    calculateArticleSimilarity(grokipediaPage, wikipediaPage),
    generateSourceVersions(grokipediaUrl, wikipediaUrl),
  ]);

  const userMessage = `Analyze these articles:\nGROKIPEDIA (${grokipediaUrl})\n${grokipediaPage}\n\n---\n\nWIKIPEDIA (${wikipediaUrl})\n${wikipediaPage}`;

  const response = await biasDetectorAgent.invoke({
    messages: [{ role: "user", content: userMessage }],
  });

  const intermediateReport = assembleReport({
    llmResponse: response.structuredResponse,
    similarity,
    sourceVersions,
  });

  const knowledgeAsset = splitReportForDKG(intermediateReport);

  return knowledgeAsset;
}

export const registerBiasDetector: DkgPlugin = (_, mcp, api) => {
  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ grokipediaUrl, wikipediaUrl, analysisDepth }) => {
      const depth = (analysisDepth ?? "medium") as AnalysisDepth;
      const knowledgeAsset = await runBiasDetection(grokipediaUrl, wikipediaUrl, depth);

      const text = `Research completed for URL pair:\nGrokipedia page: ${grokipediaUrl}\nWikipedia page: ${wikipediaUrl}\nAnalysis depth: ${depth}\n\nThe report contains:\n- PUBLIC part: Free summary with bias rating, metrics, and issue counts\n- PRIVATE part: Detailed claim reviews with citations (accessible via x402 payment)\n`;

      return {
        content: [
          { type: "text", text },
          {
            type: "text",
            text: JSON.stringify(knowledgeAsset, null, 2),
          },
        ],
      };
    },
  );

  api.get(
    `/${name}`,
    openAPIRoute(
      {
        tag: title,
        summary: description,
        description: description,
        query: z.object(inputSchema),
        response: {
          description: "Bias Report Knowledge Asset (public/private split)",
          schema: BiasReportKnowledgeAssetSchema,
        },
      },
      async (req, res) => {
        const { wikipediaUrl, grokipediaUrl, analysisDepth } = req.query;
        const depth = (analysisDepth ?? "medium") as AnalysisDepth;
        const knowledgeAsset = await runBiasDetection(grokipediaUrl, wikipediaUrl, depth);
        res.json(knowledgeAsset);
      },
    ),
  );
};
