import { type DkgPlugin } from "@dkg/plugins";
import { z } from "@dkg/plugin-swagger";

import { dkgQueryHandler } from "./tools/dkg-query/index.js";

const title = "Query DKG";
const name = "query-dkg";
const description = `Query the OriginTrail Decentralized Knowledge Graph (DKG) using natural language.

**When to use:** User wants to explore or search data in the DKG, especially bias lens reports.

**How it works:**
1. Converts natural language to SPARQL using an LLM agent
2. Automatically discovers schema (classes, predicates) on-demand
3. Supports multi-hop queries (up to 20 SPARQL executions per query)
4. Iteratively refines queries if initial attempts return no results
5. Returns natural language answer with all executed SPARQL queries

**Bias Lens Reports:**
The DKG stores bias analysis reports as ClaimReview entities. You can query by:
- **Report ID**: "urn:dkg:bias-report:{uuid}" format - provide this ID directly if you have it
- **Article URL**: itemReviewed.url (Grokipedia) or isBasedOn.url (Wikipedia baseline)
- **Article Title**: itemReviewed.name or use keyword search
- **Bias Rating**: reviewRating.ratingValue (1=severe, 2=high, 3=moderate, 4=low, 5=none)
- **Keywords**: Array of detected bias patterns
- **Date**: datePublished (ISO 8601 timestamp)
- **Publisher**: publisher.name, publisher.url
- **Review Summary**: reviewBody text

**Example queries:**
- "How many bias reports are stored in the DKG?"
- "Find all bias reports for grokipedia.com/page/Climate_change"
- "Show reports with severe or high bias (rating ≤ 2)"
- "What articles were analyzed in December 2024?"
- "Find reports about articles containing 'climate' in the title"
- "Get report urn:dkg:bias-report:12345678-1234-1234-1234-123456789abc"
- "What's the average bias rating across all reports?"
- "Find the most analyzed articles"

**General queries:**
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
