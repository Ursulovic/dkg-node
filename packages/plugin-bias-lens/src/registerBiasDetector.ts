// import { setMaxListeners } from "events";
// setMaxListeners(0);

import { type DkgPlugin } from "@dkg/plugins";
import { openAPIRoute, z } from "@dkg/plugin-swagger";

import biasDetectorAgent from "./agents/bias-detector/agent";
import { BiasDetectionReportSchema } from "./agents/bias-detector/schema";
import { WikipediaLoader } from "./loaders/wikipedia";
import { GrokipediaLoader } from "./loaders/grokipedia";

const title = "Detect Bias";
const name = "detect-bias";
const description =
  "Runs a deep analysis of Grokipedia page against given Wikipedia page and produces high-quality bias report knowledge asset. You will receive this knowledge asset as valid JSONLD and offer user to save it to DKG using your existing tools. When offering user to save it to DKG you need to ask whether this is a public or private note and all relevant questions needed for saving to DKG operation. Do not change the given JSONLD except setting public/private. Note: You can use this tool directly if user pastes you both urls, also if user pastes just a single grokipedia/wikipedia url call the research-topic topic tool with a query that includes given url.";
const inputSchema = {
  grokipediaUrl: z.string().describe("Grokipedia URL to analyze for bias"),
  wikipediaUrl: z
    .string()
    .describe("Wikipedia URL used as baseline for bias analysis"),
};

export const registerBiasDetector: DkgPlugin = (_, mcp, api) => {
  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ grokipediaUrl, wikipediaUrl }) => {
      const [grokipediaDocs, wikipediaDocs] = await Promise.all([
        new GrokipediaLoader().loadPage(grokipediaUrl),
        new WikipediaLoader().loadPage(wikipediaUrl),
      ]);

      const grokipediaPage = grokipediaDocs[0]?.pageContent;
      const wikipediaPage = wikipediaDocs[0]?.pageContent;

      const userMessage = `Analyze these articles:\nGROKIPEDIA (${grokipediaUrl})\n${grokipediaPage}\n\n---\n\nWIKIPEDIA (${wikipediaUrl})\n${wikipediaPage}`;

      const response = await biasDetectorAgent.invoke({
        messages: [{ role: "user", content: userMessage }],
      });

      const text = `Research completed for URL pair:\nGrokipedia page: ${grokipediaUrl}\n\n-----\n\nWikipedia page: ${wikipediaUrl}\n`;

      return {
        content: [
          { type: "text", text },
          {
            type: "text",
            text: JSON.stringify(response.structuredResponse, null, 2),
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
          description: "TopicUrlPair Result",
          schema: BiasDetectionReportSchema,
        },
      },
      async (req, res) => {
        const { wikipediaUrl, grokipediaUrl } = req.query;
        const [grokipediaDocs, wikipediaDocs] = await Promise.all([
          new GrokipediaLoader().loadPage(grokipediaUrl),
          new WikipediaLoader().loadPage(wikipediaUrl),
        ]);

        const grokipediaPage = grokipediaDocs[0]?.pageContent;
        const wikipediaPage = wikipediaDocs[0]?.pageContent;

        const userMessage = `Analyze these articles:\nGROKIPEDIA (${grokipediaUrl})\n${grokipediaPage}\n\n---\n\nWIKIPEDIA (${wikipediaUrl})\n${wikipediaPage}`;

        const response = await biasDetectorAgent.invoke({
          messages: [{ role: "user", content: userMessage }],
        });

        res.json(response.structuredResponse);
      },
    ),
  );
};
