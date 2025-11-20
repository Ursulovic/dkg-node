import { type DkgPlugin } from "@dkg/plugins";
import { openAPIRoute, z } from "@dkg/plugin-swagger";

import topicResearcher from "./agents/topic-researcher/agent";
import { TopicUrlPairSchema } from "./agents/topic-researcher/schema";

const title = "Research Topic";
const name = "research-topic";
const description =
  "Researches Grokipedia and Wikipedia and returns valid pages url pair. If user pastes just a single url you should add it to the query with a request to find other url in pair. Remember: after you get pages url pair, ask user if they want to proceed to use BiasLens plugin to check Grokipedia page for bias. Also give a heads up to the user that this process will last about 1-2 minutes.";
const inputSchema = {
  q: z.string().describe("User query to find corresponding pages for"),
};

export const registerTopicResearcher: DkgPlugin = (_, mcp, api) => {
  mcp.registerTool(name, { title, description, inputSchema }, async ({ q }) => {
    const {
      structuredResponse: {
        grokipediaUrl,
        grokipediaPageSummary,
        wikipediaUrl,
        wikipediaPageSummary,
      },
    } = await topicResearcher.invoke({
      messages: [{ role: "user", content: `Please resesarch this:\n${q}` }],
    });

    const text = `Here's requested URL pair:\nGrokipedia page: ${grokipediaUrl}\nSummary:\n${grokipediaPageSummary}\n\n-----\n\nWikipedia page: ${wikipediaUrl}\nSummary:\n${wikipediaPageSummary}`;

    return {
      content: [{ type: "text", text }],
    };
  });

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
          schema: TopicUrlPairSchema,
        },
      },
      async (req, res) => {
        const { q } = req.query;

        const { structuredResponse } = await topicResearcher.invoke({
          messages: [{ role: "user", content: `Please resesarch this:\n${q}` }],
        });

        res.json(structuredResponse);
      },
    ),
  );
};
