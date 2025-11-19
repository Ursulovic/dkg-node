import "dotenv/config";

import { defineDkgPlugin } from "@dkg/plugins";
import { openAPIRoute, z } from "@dkg/plugin-swagger";
import { detectBiasInGrokipediaPage } from "./bias-detection/pipeline";

async function findBiasesInGrokipediaPage(
  grokipediaUrl: string,
  wikipediaUrl: string,
): Promise<string> {
  try {
    // detectBiasInGrokipediaPage returns { markdown, jsonld }
    const result = await detectBiasInGrokipediaPage({
      grokipediaUrl,
      wikipediaUrl,
    });

    // Return markdown for MCP/API response (jsonld can be added later if needed)
    return result.markdown;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error analyzing ${grokipediaUrl}: ${errorMessage}`;
  }
}

export default defineDkgPlugin((ctx, mcp, api) => {
  mcp.registerTool(
    "find-bias-in-grokipedia-page",
    {
      title: "Find bias in Grokipedia page",
      description: "Use this to check for biases in given Grokipedia page by comparing it with Wikipedia.",
      inputSchema: {
        grokipediaUrl: z.string().url(),
        wikipediaUrl: z.string().url(),
      },
    },
    async ({ grokipediaUrl, wikipediaUrl }) => {
      const result = await findBiasesInGrokipediaPage(grokipediaUrl, wikipediaUrl);
      return {
        content: [{ type: "text", text: result }],
      };
    },
  );

  api.get(
    "/find-bias-in-grokipedia-page",
    openAPIRoute(
      {
        tag: "Bias Lens",
        summary: "Find bias in Grokipedia page",
        description: "Analyze a Grokipedia page for bias by comparing it with Wikipedia",
        query: z.object({
          grokipediaUrl: z.string({ coerce: true }).url().openapi({
            description: "The Grokipedia page URL to be checked for biases.",
            example: "https://grokipedia.com/page/Global_warming_potential",
          }),
          wikipediaUrl: z.string({ coerce: true }).url().openapi({
            description: "The corresponding Wikipedia page URL to compare against.",
            example: "https://en.wikipedia.org/wiki/Global_warming_potential",
          }),
        }),
        response: {
          description: "Bias analysis report",
          schema: z.object({
            result: z.string(),
          }),
        },
      },
      async (req, res) => {
        const { grokipediaUrl, wikipediaUrl } = req.query;
        const result = await findBiasesInGrokipediaPage(grokipediaUrl, wikipediaUrl);
        res.json({ result });
      },
    ),
  );
});
