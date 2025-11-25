import { type DkgPlugin } from "@dkg/plugins";
import { openAPIRoute, z } from "@dkg/plugin-swagger";

import { runBiasDetection } from "./pipeline/runBiasDetection.js";
import { BiasReportKnowledgeAssetSchema } from "./agents/bias-detector/schema.js";
import type { AnalysisDepth } from "./types/depth.js";

const title = "Detect Bias";
const name = "detect-bias";
const description = `Analyzes a Grokipedia page against Wikipedia to detect bias and produce a detailed report.

**When to use:** User has both Grokipedia and Wikipedia URLs and wants bias analysis.

**Input:**
- grokipediaUrl: The Grokipedia page to analyze
- wikipediaUrl: The Wikipedia baseline for comparison
- analysisDepth: "low" | "medium" | "high" (affects cost and thoroughness)

**Output:** Returns a JSON-LD bias report with:
- **Report IRI**: Unique identifier (e.g., https://bias-lens.neuroweb.ai/report/{uuid})
- **PUBLIC part** (free): Summary, bias rating (1-5), issue counts, cost breakdown
- **PRIVATE part** (paid via x402): Detailed claim reviews with citations

**After receiving the report, inform the user:**
1. Bias level and summary
2. Number of issues found (factual errors, missing context, etc.)
3. Analysis costs (USD and TRAC)
4. Report has been saved with IRI: {reportIri}
5. Ask: "Would you like to publish this report to DKG? (This will make it permanent and shareable)"

**To publish the report:**
Use 'save-bias-report' tool with the report IRI. This will:
1. Fetch the report content from storage (no need to stream JSON-LD!)
2. Publish to DKG
3. Return the UAL and DKG Explorer link

**Important:** The report is temporarily stored in memory. Publishing to DKG makes it permanent.`;

const inputSchema = {
  grokipediaUrl: z.string().describe("Grokipedia URL to analyze for bias"),
  wikipediaUrl: z
    .string()
    .describe("Wikipedia URL used as baseline for bias analysis"),
  analysisDepth: z
    .enum(["low", "medium", "high"])
    .default("medium")
    .describe(
      "Analysis depth: low (quick, top 5-10 claims), medium (balanced, top 15-25 claims), high (comprehensive, all claims)",
    ),
};

export const registerBiasDetector: DkgPlugin = (_, mcp, api) => {
  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ grokipediaUrl, wikipediaUrl, analysisDepth }) => {
      const depth = (analysisDepth ?? "medium") as AnalysisDepth;
      const { id, knowledgeAsset } = await runBiasDetection(
        grokipediaUrl,
        wikipediaUrl,
        depth,
      );

      const text = `Bias analysis completed!\n\nReport ID: ${id}\nGrokipedia page: ${grokipediaUrl}\nWikipedia page: ${wikipediaUrl}\nAnalysis depth: ${depth}\n\nThe report contains:\n- PUBLIC part: Free summary with bias rating, metrics, and issue counts\n- PRIVATE part: Detailed claim reviews with citations (accessible via x402 payment)\n\nThe report has been saved with ID: ${id}`;

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
        const { knowledgeAsset } = await runBiasDetection(
          grokipediaUrl,
          wikipediaUrl,
          depth,
        );
        res.json(knowledgeAsset);
      },
    ),
  );
};
