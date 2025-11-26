import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DkgClient } from "../../types.js";
import { validateSparql, wrapSparqlStringWithDkgPattern } from "../../sparql/generator.js";

const executeQuerySchema = z.object({
  sparqlQuery: z
    .string()
    .describe(
      "A valid SPARQL SELECT query string. Do NOT include DKG graph patterns - the system adds them automatically."
    ),
  skipDkgWrapper: z
    .boolean()
    .nullish()
    .describe("Set to true only for raw discovery queries that already include graph patterns"),
});

export function createExecuteSparqlTool(dkgClient: DkgClient) {
  return tool(
    async ({ sparqlQuery, skipDkgWrapper }) => {
      try {
        const validation = validateSparql(sparqlQuery);
        if (!validation.valid) {
          return JSON.stringify({
            success: false,
            error: `Invalid SPARQL syntax: ${validation.error}`,
            sparqlAttempted: sparqlQuery,
            suggestion: "Fix the SPARQL syntax error and try again.",
          });
        }

        let finalSparql = sparqlQuery;

        if (!skipDkgWrapper) {
          const wrapped = wrapSparqlStringWithDkgPattern(sparqlQuery);
          if (!wrapped.success) {
            return JSON.stringify({
              success: false,
              error: `Failed to wrap query: ${wrapped.error}`,
              sparqlAttempted: sparqlQuery,
            });
          }
          finalSparql = wrapped.sparql!;
        }

        const result = await dkgClient.graph.query(finalSparql, "SELECT");

        if (!result?.data || result.data.length === 0) {
          return JSON.stringify({
            success: true,
            count: 0,
            data: [],
            sparqlUsed: finalSparql,
            message:
              "Query returned no results. Consider using discover_predicates or discover_classes to find correct predicates.",
          });
        }

        return JSON.stringify({
          success: true,
          count: result.data.length,
          data: result.data.slice(0, 20),
          sparqlUsed: finalSparql,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return JSON.stringify({
          success: false,
          error: errorMessage,
          sparqlAttempted: sparqlQuery,
          suggestion:
            "Query execution failed. Use discover_classes to see available entity types, or discover_predicates to find valid predicates.",
        });
      }
    },
    {
      name: "execute_sparql",
      description: `Execute a SPARQL SELECT query against the DKG.

Input: A raw SPARQL SELECT query string (the system validates syntax and wraps with DKG graph patterns automatically).

Example queries:
- SELECT ?s ?name WHERE { ?s a <http://schema.org/Product> . ?s <http://schema.org/name> ?name . }
- SELECT (COUNT(?s) AS ?count) WHERE { ?s a <http://schema.org/Organization> . }

Returns: Query results with count, data (max 20 rows), and the final SPARQL used.

On failure: Returns error with suggestions to use discovery tools.`,
      schema: executeQuerySchema,
    }
  );
}
