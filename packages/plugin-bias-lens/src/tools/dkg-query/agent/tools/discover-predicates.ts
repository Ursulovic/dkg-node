import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DkgClient } from "../../types.js";

const discoverPredicatesSchema = z.object({
  classUri: z
    .string()
    .nullish()
    .describe("URI of the class to find predicates for (e.g., http://schema.org/Product)"),
  keyword: z
    .string()
    .nullish()
    .describe("Search predicates containing this keyword (e.g., 'price', 'name')"),
  limit: z.number().nullish().describe("Maximum number of predicates to return (default: 50)"),
});

export function createDiscoverPredicatesTool(dkgClient: DkgClient) {
  return tool(
    async ({ classUri, keyword, limit }) => {
      try {
        const maxResults = limit ?? 50;

        if (!classUri && !keyword) {
          return JSON.stringify({
            success: false,
            error: "Either classUri or keyword must be provided",
            hint: "Use discover_classes first to find available entity types, then use classUri to find predicates for that type.",
          });
        }

        let query: string;

        if (classUri) {
          query = `
            PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
            SELECT DISTINCT ?predicate (COUNT(?predicate) as ?count) WHERE {
              GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
              GRAPH ?kaGraph {
                ?s a <${classUri}> .
                ?s ?predicate ?o .
              }
            }
            GROUP BY ?predicate
            ORDER BY DESC(?count)
            LIMIT ${maxResults}
          `;
        } else {
          const safeKeyword = keyword!.toLowerCase().replace(/['"\\]/g, "");
          query = `
            PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
            SELECT DISTINCT ?predicate (COUNT(?predicate) as ?count) WHERE {
              GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
              GRAPH ?kaGraph { ?s ?predicate ?o . }
              FILTER(CONTAINS(LCASE(STR(?predicate)), "${safeKeyword}"))
            }
            GROUP BY ?predicate
            ORDER BY DESC(?count)
            LIMIT ${maxResults}
          `;
        }

        const result = await dkgClient.graph.query(query, "SELECT");

        if (!result?.data || result.data.length === 0) {
          const searchContext = classUri ? `class <${classUri}>` : `keyword "${keyword}"`;
          return JSON.stringify({
            success: true,
            predicates: [],
            message: `No predicates found for ${searchContext}. Try discover_classes to see available entity types.`,
          });
        }

        const predicates = result.data.map((row) => ({
          predicate: String(row.predicate),
          count: Number(row.count),
        }));

        return JSON.stringify({
          success: true,
          count: predicates.length,
          searchedBy: classUri ? { classUri } : { keyword },
          predicates,
          hint: "Use these predicate URIs in your SPARQL query triples.",
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "discover_predicates",
      description: `Discover predicates (properties) available in the DKG.

Two discovery modes:
1. By class URI: Find all predicates used with entities of a specific type
2. By keyword: Search for predicates containing a keyword in their URI

Use this when:
- A query returned no results - find the correct predicate names
- You need to know what properties exist for an entity type
- You're unsure of the exact predicate URI

Examples:
- classUri: "http://schema.org/Product" → finds all predicates used with Products
- keyword: "price" → finds predicates like schema:price, schema:priceSpecification, etc.`,
      schema: discoverPredicatesSchema,
    }
  );
}
