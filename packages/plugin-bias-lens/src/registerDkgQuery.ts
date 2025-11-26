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
4. Returns data with the SPARQL query used

**Examples:**
- "How many products are stored in the DKG?"
- "Find all organizations with their names"
- "What audits have compliance scores below 70?"
- "List the most recent Knowledge Assets by publisher"

**Output:** Query results as JSON array, plus the SPARQL query used.`;

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

      const summary = result.data.length === 0
        ? "Query returned no results."
        : `Found ${result.data.length} result(s).`;

      const text = `**DKG Query Results**

${summary}

SPARQL Used:
\`\`\`sparql
${result.sparqlUsed}
\`\`\`

Results:`;

      return {
        content: [
          { type: "text", text },
          {
            type: "text",
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    }
  );
};
