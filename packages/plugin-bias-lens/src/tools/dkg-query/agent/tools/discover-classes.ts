import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DkgClient, ClassInfo } from "../../types.js";

const discoverClassesSchema = z.object({
  limit: z.number().nullish().describe("Maximum number of classes to return (default: 30)"),
});

export function createDiscoverClassesTool(dkgClient: DkgClient) {
  return tool(
    async ({ limit }) => {
      try {
        const maxResults = limit ?? 30;

        const query = `
          PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
          SELECT DISTINCT ?type (COUNT(?type) as ?count) WHERE {
            GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
            GRAPH ?kaGraph { ?s a ?type . }
          }
          GROUP BY ?type
          ORDER BY DESC(?count)
          LIMIT ${maxResults}
        `;

        const result = await dkgClient.graph.query(query, "SELECT");

        if (!result?.data || result.data.length === 0) {
          return JSON.stringify({
            success: true,
            classes: [],
            message: "No entity types found in the DKG. The graph may be empty.",
          });
        }

        const classes: ClassInfo[] = result.data.map((row) => ({
          type: String(row.type),
          count: Number(row.count),
        }));

        return JSON.stringify({
          success: true,
          count: classes.length,
          classes,
          hint: "Use these class URIs in your queries with 'a' (rdf:type) predicate. Use discover_predicates to find predicates for a specific class.",
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "discover_classes",
      description: `Discover what entity types (classes) exist in the DKG.

Returns a list of RDF classes with their instance counts, ordered by frequency.

Use this when:
- Starting a new query and unsure what data exists
- A query returned no results and you need to verify the entity type
- You want to explore what's available in the DKG

Example output: [{ type: "http://schema.org/Product", count: 500 }, ...]`,
      schema: discoverClassesSchema,
    }
  );
}
