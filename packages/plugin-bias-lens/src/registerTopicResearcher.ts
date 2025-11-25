import { type DkgPlugin } from "@dkg/plugins";
import { openAPIRoute, z } from "@dkg/plugin-swagger";

import topicResearcher from "./agents/topic-researcher/agent";
import { TopicUrlPairSchema } from "./agents/topic-researcher/schema";

const title = "Research Topic";
const name = "research-topic";
const description = `Researches a topic to find matching Grokipedia and Wikipedia page URLs.

**When to use:** User wants to research a topic but doesn't have the exact URLs yet.

**Input:** A topic query (e.g., "climate change", "COVID-19 vaccines", or a single URL to find its pair)

**Output:** Returns URL pair with page summaries.

**Next step:** After receiving the URL pair, ask the user:
1. "Would you like me to run bias detection on these pages?"
2. "What analysis depth would you prefer?"
   - **low**: Quick scan (~1 min, 5-10 claims, lower cost)
   - **medium**: Balanced analysis (~2 min, 15-25 claims, moderate cost) [default]
   - **high**: Comprehensive review (~3-5 min, all claims, higher cost)`;
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
