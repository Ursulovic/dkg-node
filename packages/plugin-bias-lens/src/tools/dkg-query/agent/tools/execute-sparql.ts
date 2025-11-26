import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DkgClient } from "../../types.js";
import { validateSparql, wrapSparqlStringWithDkgPattern } from "../../sparql/generator.js";

export const createExecuteSparqlTool = (dkgClient: DkgClient) =>
  tool(
    async ({ sparql }) => {
      const validation = validateSparql(sparql);
      if (!validation.valid) {
        return JSON.stringify({ error: `Invalid SPARQL: ${validation.error}` });
      }

      const wrapped = wrapSparqlStringWithDkgPattern(sparql);
      if (!wrapped.success) {
        return JSON.stringify({ error: `Wrap failed: ${wrapped.error}` });
      }

      try {
        const result = await dkgClient.graph.query(wrapped.sparql!, "SELECT");
        return JSON.stringify({
          success: true,
          data: result.data || [],
          count: result.data?.length ?? 0,
        });
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "execute_sparql",
      description:
        "Execute a SPARQL SELECT query against the DKG. The query will be automatically wrapped with DKG graph patterns. Use full URIs discovered from search_classes and discover_predicates.",
      schema: z.object({
        sparql: z.string().describe("SPARQL SELECT query to execute"),
      }),
    }
  );
