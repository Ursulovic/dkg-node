import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DkgClient } from "../../types.js";
import { selectQuerySchema } from "../../sparql/schema.js";
import { generateSparql, wrapWithDkgGraphPattern } from "../../sparql/generator.js";

const executeQuerySchema = z.object({
  queryJson: selectQuerySchema.describe(
    "SPARQL.js JSON query object. The system will automatically wrap it with DKG graph traversal pattern."
  ),
  skipDkgWrapper: z
    .boolean()
    .nullish()
    .describe("Set to true if query already includes DKG graph patterns (for raw discovery queries)"),
});

export function createExecuteSparqlTool(dkgClient: DkgClient) {
  return tool(
    async ({ queryJson, skipDkgWrapper }) => {
      try {
        const finalQuery = skipDkgWrapper ? queryJson : wrapWithDkgGraphPattern(queryJson);
        const sparqlString = generateSparql(finalQuery);

        const result = await dkgClient.graph.query(sparqlString, "SELECT");

        if (!result?.data || result.data.length === 0) {
          return JSON.stringify({
            success: true,
            count: 0,
            data: [],
            sparqlUsed: sparqlString,
            message:
              "Query returned no results. Consider using discover_predicates or discover_classes to find correct predicates.",
          });
        }

        return JSON.stringify({
          success: true,
          count: result.data.length,
          data: result.data.slice(0, 20),
          sparqlUsed: sparqlString,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return JSON.stringify({
          success: false,
          error: errorMessage,
          suggestion:
            "Query failed. Use discover_classes to see available entity types, or discover_predicates to find valid predicates.",
        });
      }
    },
    {
      name: "execute_sparql",
      description: `Execute a SPARQL SELECT query against the DKG.

Input: A SPARQL.js JSON query object that will be:
1. Wrapped with DKG graph traversal pattern (current:graph -> containedGraph)
2. Converted to SPARQL string
3. Executed against DKG

Returns: Query results or error with suggestions for discovery.

IMPORTANT: Use proper SPARQL.js JSON format with termType fields (Variable, NamedNode, Literal).`,
      schema: executeQuerySchema,
    }
  );
}
