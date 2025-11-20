import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

const sparqlResultSchema = z.object({
  canAnswer: z.boolean().describe('Whether this query can be answered with Wikidata'),
  reason: z.string().nullish().describe('Explanation if query cannot be answered'),
  entityId: z.string().nullish().describe('Wikidata entity ID (Q123...)'),
  entityLabel: z.string().nullish().describe('Human-readable entity name'),
  propertyId: z.string().nullish().describe('Wikidata property ID (P123...)'),
  propertyLabel: z.string().nullish().describe('Human-readable property name'),
  sparqlQuery: z.string().nullish().describe('Valid SPARQL query to execute'),
});

type SparqlGenerationResult = z.infer<typeof sparqlResultSchema>;

interface GenerationContext {
  properties: Array<{
    id: string;
    label: string;
    description?: string;
    aliases?: string[];
    datatype?: string;
  }>;
  entityTypes?: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  constraints?: Array<{
    propertyId: string;
    constraintTypeLabel: string;
    subjectTypes?: string[];
    valueTypes?: string[];
  }>;
}

export async function generateSparql(
  query: string,
  context: GenerationContext,
): Promise<SparqlGenerationResult> {
  const llm = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0,
  });

  const structuredLlm = llm.withStructuredOutput(sparqlResultSchema);

  const systemPrompt = `You are a Wikidata SPARQL query generator. Your job is to:
1. Analyze the user's natural language question
2. Identify the Wikidata entity and property being queried
3. Generate a valid SPARQL query to answer the question

IMPORTANT RULES:
- Set canAnswer=true ONLY if you can confidently identify both entity and property
- Set canAnswer=false if the query is ambiguous, nonsensical, or cannot be answered with the provided context
- Always use the exact property IDs from the context (e.g., P570 for "date of death")
- Generate simple SELECT queries that return ONE value
- Use wdt: prefix for direct property access
- Include SERVICE wikibase:label for readable results

SPARQL Query Template:
PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wikibase: <http://wikiba.se/ontology#>
PREFIX bd: <http://www.bigdata.com/rdf#>

SELECT ?value ?valueLabel WHERE {
  wd:[ENTITY_ID] wdt:[PROPERTY_ID] ?value.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 1

Examples:
Query: "When did George Floyd die?"
- Entity: Search for "George Floyd" → Q95677819
- Property: "date of death" → P570
- canAnswer: true
- sparqlQuery: (use template above with Q95677819 and P570)

Query: "xyzabc nonsense query"
- canAnswer: false
- reason: "Query is not a valid factual question about a Wikidata entity"`;

  const userPrompt = `User Query: "${query}"

Available Context:
Properties (top matches):
${context.properties
  .slice(0, 5)
  .map((p) => `- ${p.id} (${p.label}): ${p.description || 'No description'}`)
  .join('\n')}

${
  context.entityTypes && context.entityTypes.length > 0
    ? `Entity Types (top matches):
${context.entityTypes.map((e) => `- ${e.id} (${e.label}): ${e.description || 'No description'}`).join('\n')}`
    : ''
}

${
  context.constraints && context.constraints.length > 0
    ? `Relevant Constraints:
${context.constraints
  .slice(0, 3)
  .map(
    (c) =>
      `- Property ${c.propertyId}: ${c.constraintTypeLabel}${c.subjectTypes ? ` (valid for: ${c.subjectTypes.join(', ')})` : ''}`,
  )
  .join('\n')}`
    : ''
}

Generate the SPARQL query to answer this question.`;

  const result = await structuredLlm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]);

  return result as SparqlGenerationResult;
}
