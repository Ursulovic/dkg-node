import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { executeSparql } from '../../query/executor.js';

const executeSparqlSchema = z.object({
  sparqlQuery: z.string().describe('The SPARQL query to execute against Wikidata'),
});

export function createExecuteSparqlTool() {
  return new DynamicStructuredTool({
    name: 'execute_sparql_query',
    description: 'Execute a SPARQL query against the Wikidata endpoint and return the results. If the query fails, the error message will be returned to help you refine your approach.',
    schema: executeSparqlSchema,
    func: async ({ sparqlQuery }) => {
      try {
        const result = await executeSparql(sparqlQuery);

        if (!result) {
          return JSON.stringify({
            success: false,
            error: 'Query returned null result',
          });
        }

        if (!result.results.bindings || result.results.bindings.length === 0) {
          return JSON.stringify({
            success: false,
            error: 'Query returned no results. The entity might not have this property, or the query might be malformed.',
          });
        }

        return JSON.stringify({
          success: true,
          bindings: result.results.bindings,
          count: result.results.bindings.length,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return JSON.stringify({
          success: false,
          error: errorMessage,
        });
      }
    },
  });
}
