import { type DkgPlugin } from "@dkg/plugins";
import { z } from "@dkg/plugin-swagger";

import { dkgQueryHandler } from "./tools/dkg-query/index.js";

const title = "Query DKG";
const name = "query-dkg";
const description = `⚠️ **CRITICAL USAGE RULE - READ THIS FIRST** ⚠️

**YOU MUST CALL THIS TOOL EXACTLY ONCE PER USER REQUEST.**

DO NOT make multiple calls to this tool. Instead, combine all questions into a single array.

❌ WRONG (Multiple calls):
- Call 1: query-dkg(["Count climate reports"])
- Call 2: query-dkg(["Count technology reports"])

✅ CORRECT (Single call with array):
- Call 1: query-dkg(["Count climate reports", "Count technology reports"])

This tool is designed to handle multiple queries in ONE call. The internal agent will process them optimally with shared context.

---

Query the OriginTrail Decentralized Knowledge Graph (DKG) using natural language.

**When to use:** User wants to explore or search data in the DKG, especially bias lens reports.

**How it works:**
1. Converts natural language to SPARQL using an LLM agent (GPT-4o)
2. Automatically discovers schema (classes, predicates) on-demand
3. Supports multi-hop queries via intelligent query planning
4. Iteratively refines queries if initial attempts return no results
5. Returns complete data without summarization

**Array Format Examples:**
- Single question: ["How many bias reports are there?"]
- Multi-hop question: ["Find climate reports", "Count how many have severe bias"]
- Related queries: ["List all reports", "Calculate average name length"]

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
    .array(z.string())
    .describe(
      "Array of natural language questions about data in the DKG. " +
      "For single questions, provide a single-item array. " +
      "For complex multi-hop questions or related queries, provide multiple questions " +
      "that will be processed together with shared context."
    ),
};

const activeToolCalls = new Set<string>();

export const registerDkgQuery: DkgPlugin = (ctx, mcp) => {
  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ query }) => {
      const callId = `${Date.now()}-${Math.random()}`;

      if (activeToolCalls.size > 0) {
        return {
          content: [{
            type: "text",
            text: "⚠️ ERROR: Multiple simultaneous calls detected. Please combine your queries into a single array instead of making multiple tool calls. Example: query-dkg([\"query1\", \"query2\"]) instead of two separate calls."
          }]
        };
      }

      try {
        activeToolCalls.add(callId);
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
      } finally {
        activeToolCalls.delete(callId);
      }
    }
  );
};
