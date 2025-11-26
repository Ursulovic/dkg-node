import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DkgClient } from "../../types.js";

function extractNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const str = String(value);
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export const createListPopularClassesTool = (dkgClient: DkgClient) =>
  tool(
    async () => {
      const query = `
        PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
        SELECT DISTINCT ?type (COUNT(?s) as ?count) WHERE {
          GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
          GRAPH ?kaGraph { ?s a ?type . }
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
      name: "list_popular_classes",
      description:
        "List the most common classes in the DKG by instance count. Use as fallback when search_classes returns no results, or to get an overview of available data.",
      schema: z.object({}),
    }
  );
