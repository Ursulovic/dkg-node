import { WikidataVectorStore } from "./vectordb/store";
import { createWikidataSparqlAgent } from "./sparql/agent";
import type { WikidataQueryInput, WikidataQueryResult } from "./types";
import { StringOutputParser } from "@langchain/core/output_parsers";

let vectorStore: WikidataVectorStore | null = null;

async function getVectorStore(): Promise<WikidataVectorStore> {
  if (!vectorStore) {
    vectorStore = new WikidataVectorStore();
    await vectorStore.load();
  }
  return vectorStore;
}

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

export async function wikidataQueryHandler(
  input: WikidataQueryInput,
): Promise<WikidataQueryResult> {
  try {
    const store = await getVectorStore();
    const agent = await createWikidataSparqlAgent(store);

    const state = await agent.invoke({
      messages: [{ role: "user", content: input.query }],
    });

    const parser = new StringOutputParser();

    const lastMessage = state.messages[state.messages.length - 1]!;
    const response = await parser.invoke(lastMessage);

    return {
      success: true,
      response: response,
    };
  } catch (error) {
    console.error("Wikidata query handler error:", error);
    return {
      success: false,
      response: "",
      error:
        "An unexpected error occurred while processing your query. Please try again or rephrase your question.",
    };
  }
}
