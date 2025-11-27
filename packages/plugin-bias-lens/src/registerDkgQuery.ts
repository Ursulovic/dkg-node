import { type DkgPlugin } from "@dkg/plugins";
import { z } from "@dkg/plugin-swagger";

import { dkgQueryHandler } from "./tools/dkg-query/index.js";

const title = "Query DKG";
const name = "query-dkg";
const description = `Query the OriginTrail Decentralized Knowledge Graph (DKG) using natural language.

**When to use:** User wants to explore or search data in the DKG.

**How it works:**
1. Converts natural language to SPARQL using an LLM agent
2. Automatically discovers schema (classes, predicates) on-demand
3. Iteratively refines queries if initial attempts return no results
4. Returns natural language answer with all executed SPARQL queries

**Examples:**
- "How many products are stored in the DKG?"
- "Find all organizations with their names"
- "What audits have compliance scores below 70?"

**IMPORTANT:** This tool returns multiple text items - a textual answer followed by all executed SPARQL queries. You MUST display all returned SPARQL queries as code blocks in your response to the user.`;

const inputSchema = {
  query: z
    .string()
    .describe(
      "Natural language question about data in the DKG"
    ),
};

export const registerDkgQuery: DkgPlugin = (ctx, mcp) => {
  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ query }) => {
      const result = await dkgQueryHandler({ query }, ctx.dkg);

      const content: Array<{ type: "text"; text: string }> = [];

      if (!result.success) {
        content.push({
          type: "text",
          text: `Error querying DKG: ${result.error}`,
        });
      } else {
        content.push({ type: "text", text: result.answer });
      }

      for (const sparql of result.executedQueries) {
        content.push({
          type: "text",
          text: `\`\`\`sparql\n${sparql}\n\`\`\``,
        });
      }

      return { content };
    }
  );
};
