import { z } from "zod";
import {
  createAgent,
  providerStrategy,
  toolCallLimitMiddleware,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { WikidataVectorStore } from "../vectordb/store.js";
import { createVectorSearchTool } from "./tools/vector-search.js";
import { createExecuteSparqlTool } from "./tools/execute-sparql.js";

const responseSchema = z
  .object({
    success: z
      .boolean()
      .describe("Whether the query was successfully answered"),
    entityId: z
      .string()
      .nullish()
      .describe("The Wikidata entity ID (Q-code) if found"),
    propertyId: z
      .string()
      .nullish()
      .describe("The Wikidata property ID (P-code) if found"),
    sparqlQuery: z
      .string()
      .nullish()
      .describe("The final SPARQL query that succeeded"),
    value: z
      .union([z.string(), z.number()])
      .nullish()
      .describe("The answer value extracted from Wikidata"),
    error: z
      .string()
      .nullish()
      .describe("Error message if the query could not be answered"),
    reasoning: z
      .string()
      .describe(
        "Explanation of the approach taken and why it succeeded or failed",
      ),
  })
  .required();

const systemPrompt = `You are a Wikidata SPARQL query expert. Your job is to answer natural language questions by:

1. **Understanding the query**: Identify what entity and property are being asked about
2. **Searching for properties**: Use the vector store to find relevant Wikidata properties (P-codes)
3. **Searching for entity types**: Use the vector store to find relevant entity types (Q-codes) if needed
4. **Generating SPARQL**: Create a SPARQL query to get the answer
5. **Executing and refining**: Execute the query and refine if it fails

## Search Strategy

- Search for properties with descriptive queries like "date of birth", "population", "capital city"
- Search for entity types with queries like "person", "country", "organization"
- Search for constraints to validate property-entity compatibility
- Use type: "property" for properties, "entity-type" for classes, "constraint" for validation rules

## SPARQL Query Patterns

### Basic property query:
\`\`\`sparql
SELECT ?value ?valueLabel WHERE {
  wd:Q123 wdt:P456 ?value .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
\`\`\`

### Query with qualifiers (dates, locations, etc.):
\`\`\`sparql
SELECT ?value ?valueLabel ?startDate WHERE {
  wd:Q123 p:P456 ?statement .
  ?statement ps:P456 ?value .
  OPTIONAL { ?statement pq:P580 ?startDate . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
\`\`\`

## Error Recovery

If a query fails:
- Check if you used the right property for the entity type
- Try alternative properties (e.g., P571 "inception" instead of P569 "date of birth" for organizations)
- Verify the entity ID exists
- Simplify the query if it's too complex

## Important Rules

1. Always search the vector store before generating queries
2. Validate property-entity compatibility using constraints
3. Execute queries and learn from errors
4. Try alternative approaches if initial attempts fail
5. Use wdt: for simple values, p:/ps:/pq: for qualified statements
6. Always include the label service for human-readable results

You have up to 10 iterations to find the answer. Be systematic and learn from each attempt.`;

export async function createWikidataSparqlAgent(
  vectorStore: WikidataVectorStore,
): Promise<ReturnType<typeof createAgent>> {
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.5,
  });

  const tools = [
    createVectorSearchTool(vectorStore),
    createExecuteSparqlTool(),
  ];

  return createAgent({
    name: "wikidata-sparql-generator",
    model,
    tools,
    systemPrompt,
    middleware: [toolCallLimitMiddleware({ runLimit: 10 })],
  });
}

export type WikidataSparqlAgentResponse = z.infer<typeof responseSchema>;
