import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DkgClient } from "../../types.js";

function extractNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const str = String(value);
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export const createSearchClassesTool = (dkgClient: DkgClient) =>
  tool(
    async ({ keywords }) => {
      if (keywords.length === 0) {
        return JSON.stringify({ error: "At least one keyword is required" });
      }

      const filters = keywords
        .map((kw) => `CONTAINS(LCASE(STR(?type)), "${kw.toLowerCase()}")`)
        .join(" || ");

      const query = `
        PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
        SELECT DISTINCT ?type (COUNT(?s) as ?count) WHERE {
          GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
          GRAPH ?kaGraph { ?s a ?type . }
          FILTER(${filters})
        }
        GROUP BY ?type
        ORDER BY DESC(?count)
        LIMIT 20
      `;

      try {
        const result = await dkgClient.graph.query(query, "SELECT");
        const classes = result.data.map((row) => ({
          type: String(row.type),
          count: extractNumber(row.count),
        }));
        return JSON.stringify(classes);
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "search_classes",
      description:
        "Search for RDF classes by keywords. Use this to find classes related to the user's query. For example, to find bias reports use keywords like 'review', 'claim'. For products use 'product', 'offer'.",
      schema: z.object({
        keywords: z
          .array(z.string())
          .min(1)
          .describe("Keywords to search for in class URIs (e.g., ['review', 'claim'] for bias reports)"),
      }),
    }
  );
