import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DkgClient } from "../../types.js";

const sampleDataSchema = z.object({
  classUri: z.string().describe("URI of the class to sample data from (e.g., http://schema.org/Product)"),
  limit: z.number().nullish().describe("Maximum number of sample triples to return (default: 20)"),
});

export function createSampleDataTool(dkgClient: DkgClient) {
  return tool(
    async ({ classUri, limit }) => {
      try {
        const maxResults = limit ?? 20;

        const query = `
          PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
          SELECT ?subject ?predicate ?object WHERE {
            GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
            GRAPH ?kaGraph {
              ?subject a <${classUri}> .
              ?subject ?predicate ?object .
            }
          }
          LIMIT ${maxResults}
        `;

        const result = await dkgClient.graph.query(query, "SELECT");

        if (!result?.data || result.data.length === 0) {
          return JSON.stringify({
            success: true,
            samples: [],
            message: `No data found for class <${classUri}>. Use discover_classes to find available entity types.`,
          });
        }

        const samples = result.data.map((row) => ({
          subject: String(row.subject),
          predicate: String(row.predicate),
          object: String(row.object),
        }));

        const uniquePredicates = [...new Set(samples.map((s) => s.predicate))];
        const uniqueSubjects = [...new Set(samples.map((s) => s.subject))];

        return JSON.stringify({
          success: true,
          classUri,
          summary: {
            totalTriples: samples.length,
            uniqueEntities: uniqueSubjects.length,
            uniquePredicates: uniquePredicates.length,
          },
          predicatesFound: uniquePredicates,
          samples: samples.slice(0, 10),
          hint: "Use the predicates found here in your query. The samples show actual data structure.",
        });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "sample_data",
      description: `Get sample data for a specific entity type to understand its structure.

Returns actual triples (subject, predicate, object) for entities of the given class.

Use this when:
- You need to understand the data structure before writing a complex query
- You want to see real values to understand data formats
- You need to verify data exists for a class

This is useful for understanding:
- What predicates are actually used
- What the object values look like (URIs, literals, numbers)
- How entities are connected`,
      schema: sampleDataSchema,
    }
  );
}
