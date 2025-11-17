import "dotenv/config";

import { defineDkgPlugin } from "@dkg/plugins";
import { openAPIRoute, z } from "@dkg/plugin-swagger";
import { GrokipediaLoader } from "./loaders/grokipedia";

const grokipedia = new GrokipediaLoader();

async function findBiasesInGrokipediaPage(url: string) {
  const docs = await grokipedia.loadPage(url);

  return `Biases found on ${url}: 0\n\n Documents loaded: ${JSON.stringify(docs, null, 2)}`;
}

export default defineDkgPlugin((ctx, mcp, api) => {
  mcp.registerTool(
    "find-bias-in-grokipedia-page",
    {
      title: "Find bias in Grokipedia page",
      description: "Use this to check for biases in given Grokipedia page.",
      inputSchema: { url: z.string().url() },
    },
    async ({ url }) => {
      const result = await findBiasesInGrokipediaPage(url);
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
        description: "Add two numbers",
        query: z.object({
          url: z.string({ coerce: true }).url().openapi({
            description: "The Grokipedia page URL to be checked for biases.",
            example: "https://grokipedia.com/page/Global_warming_potential",
          }),
        }),
        response: {
          description: "Addition result",
          schema: z.object({
            result: z.string(),
          }),
        },
      },
      async (req, res) => {
        const { url } = req.query;
        const result = await findBiasesInGrokipediaPage(url);
        res.json({ result });
      },
    ),
  );
});
