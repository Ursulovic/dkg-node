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
4. Returns natural language answer with query results

**Examples:**
- "How many products are stored in the DKG?"
- "Find all organizations with their names"
- "What audits have compliance scores below 70?"

**Output format:** When presenting results to users, render any SPARQL queries as markdown code blocks with \`\`\`sparql syntax highlighting.`;

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

      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Error querying DKG: ${result.error}\n\nSPARQL attempted:\n${result.sparqlUsed || "No query generated"}`,
            },
          ],
        };
      }

      if (result.answer) {
        return {
          content: [{ type: "text", text: result.answer }],
        };
      }

      const summary = result.data.length === 0
        ? "No results found."
        : `Found ${result.data.length} result(s).`;

      return {
        content: [
          { type: "text", text: summary },
          { type: "text", text: JSON.stringify(result.data, null, 2) },
        ],
      };
    }
  );
};
