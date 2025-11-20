import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { wikidataQueryHandler } from './handler';

const textToWikidataSparqlSchema = z.object({
  query: z
    .string()
    .describe(
      'Natural language question about a Wikidata entity. Be specific about both the entity and what you want to know. Examples: "When did George Floyd die?", "What is the population of Tokyo?", "Who founded Tesla?", "What is the cause of death of George Floyd?"',
    ),
});

export const textToWikidataSparqlTool = new DynamicStructuredTool({
  name: 'text_to_wikidata_sparql',
  description: `Natural language interface to Wikidata's knowledge graph for verifying encyclopedia-style factual claims.

Ask questions in plain English and get authoritative answers from Wikidata's structured knowledge base.

WHEN TO USE:
- Verifying dates (births, deaths, founding dates, historical events)
- Checking biographical facts (occupation, nationality, education)
- Validating relationships (CEO of company, capital of country, founder of organization)
- Confirming numerical facts (population, area, height, distance)
- Geographic data (location, coordinates, elevation)

EXAMPLES:
✓ "When was Tesla founded?" → Returns inception date with Wikidata source
✓ "What is the cause of death of George Floyd?" → Returns medical cause with references
✓ "Who is the CEO of Microsoft?" → Returns current CEO with verification
✓ "What is the population of Paris?" → Returns latest population data
✓ "Where was Albert Einstein born?" → Returns birthplace

HOW IT WORKS:
- Accepts natural language queries (no need to parse entity/property yourself)
- Handles entity resolution automatically (finds Q-codes)
- Generates valid SPARQL queries using AI
- Returns structured data with Wikidata URLs for verification
- Gracefully handles ambiguous or unanswerable queries

NOT FOR:
- Scientific research findings → Use google_scholar_search instead
- Recent news/events → Use web_search instead
- Opinions or subjective claims → Not verifiable in knowledge graphs
- Complex aggregations → Single fact lookups only

RELIABILITY:
- Never returns hard errors for valid questions
- Provides helpful error messages for clarification
- All results include Wikidata entity URLs for manual verification`,
  schema: textToWikidataSparqlSchema,
  func: wikidataQueryHandler,
});
