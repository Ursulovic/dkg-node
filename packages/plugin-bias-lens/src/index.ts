import { defineDkgPlugin } from "@dkg/plugins";
import { openAPIRoute, z } from "@dkg/plugin-swagger";

function findBiasesInGrokipediaPage(url: string): string {
  return `Biases found on ${url}: 0`;
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
      return {
        content: [{ type: "text", text: findBiasesInGrokipediaPage(url) }],
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
      (req, res) => {
        const { url } = req.query;
        res.json({ result: findBiasesInGrokipediaPage(url) });
      },
    ),
  );
});
