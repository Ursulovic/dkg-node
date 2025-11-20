import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { wikidataQueryHandler } from './handler';

const wikidataQuerySchema = z.object({
  entity: z
    .string()
    .describe(
      'The exact name of the entity to query (person, organization, location, etc.). Examples: "George Floyd", "Tesla Inc", "Paris", "Mount Everest", "Elon Musk", "Microsoft"',
    ),
  property: z
    .string()
    .describe(
      'The property to query about the entity. Use descriptive names like: "inception" (founding date), "date of birth", "date of death", "population", "area", "height", "chief executive officer" (CEO), "founder", "headquarters location", "capital", "country of citizenship" (nationality), "occupation". Fuzzy matching supported.',
    ),
});

export const wikidataQueryTool = new DynamicStructuredTool({
  name: 'wikidata_query',
  description: `Query Wikidata's structured knowledge base for factual verification of encyclopedia-style claims.

Provide the entity name and property separately for precise lookups.

Use for:
1. Dates: entity="Tesla Inc", property="inception" (founding date)
2. Personal facts: entity="Einstein", property="date of birth"
3. Numerical facts: entity="Tokyo", property="population"
4. Relationships: entity="Microsoft", property="chief executive officer"
5. Geographic data: entity="France", property="area"
6. Personal attributes: entity="Marie Curie", property="occupation"

Features:
- Separate entity and property inputs (no parsing ambiguity)
- Fuzzy property matching (handles typos and variations)
- Automatic entity type validation
- Authoritative structured data with provenance

NOT for:
- Scientific research findings (use google_scholar_search)
- Recent news/events (use web_search)
- Opinions or subjective claims

Returns structured facts with Wikidata entity URLs and references.`,
  schema: wikidataQuerySchema,
  func: wikidataQueryHandler,
});
