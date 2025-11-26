import { z } from "zod";
import { DynamicStructuredTool } from "@langchain/core/tools";
import type { DkgClient } from "./types.js";
import { dkgQueryHandler } from "./handler.js";

export const dkgQueryInputSchema = z.object({
  query: z
    .string()
    .describe(
      'Natural language question to query the DKG. Examples: "How many products exist?", "Find all organizations", "What audits were conducted in 2024?"'
    ),
});

export function createDkgQueryTool(dkgClient: DkgClient): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name: "dkg_query",
    description: `Query the OriginTrail Decentralized Knowledge Graph (DKG) using natural language.

This tool converts your question into SPARQL, executes it against the DKG, and returns results.

Features:
- Automatic schema discovery (finds correct predicates/classes)
- Iterative refinement (retries with correct predicates if initial query fails)
- Complex query support (aggregations, filters, multi-hop relationships)

Examples:
- "How many products are in the DKG?"
- "Find all organizations with their names"
- "What audits have compliance scores below 70?"
- "List products by category"`,
    schema: dkgQueryInputSchema,
    func: async ({ query }) => {
      const result = await dkgQueryHandler({ query }, dkgClient);
      return JSON.stringify(result, null, 2);
    },
  });
}

export { dkgQueryHandler } from "./handler.js";
export type { DkgQueryInput, DkgQueryResult, DkgClient } from "./types.js";
