import type { DiscoveredSchema, IterationAttempt, ClassInfo, PredicateInfo } from "../types.js";

function formatClasses(classes: ClassInfo[]): string {
  if (classes.length === 0) return "No classes discovered yet.";
  return classes
    .slice(0, 15)
    .map((c) => `- <${c.type}> (${c.count} instances)`)
    .join("\n");
}

function formatPredicates(predicates: PredicateInfo[]): string {
  if (predicates.length === 0) return "No predicates discovered yet.";
  return predicates
    .slice(0, 20)
    .map((p) => `- <${p.predicate}>${p.count ? ` (${p.count} uses)` : ""}`)
    .join("\n");
}

function formatIterationHistory(history: IterationAttempt[]): string {
  if (history.length === 0) return "";

  const attempts = history.map((h) => {
    let result = `Attempt ${h.iteration}: ${h.sparqlAttempted}`;
    if (h.error) {
      result += `\n  → ERROR: ${h.error}`;
    } else if (h.resultCount === 0) {
      result += `\n  → 0 results returned`;
    }
    if (h.discoveries && h.discoveries.length > 0) {
      result += `\n  → Discovered: ${h.discoveries.join(", ")}`;
    }
    return result;
  });

  return `
## PREVIOUS ATTEMPTS - DO NOT REPEAT THESE MISTAKES

${attempts.join("\n\n")}

Learn from these failures. Use different predicates/classes based on discoveries.`;
}

function generateExamples(schema: DiscoveredSchema): string {
  const examples: string[] = [];

  const firstClass = schema.classes[0];
  if (firstClass) {
    const className = firstClass.type.split("/").pop() ?? "Entity";
    examples.push(`# Count all ${className} entities
SELECT (COUNT(DISTINCT ?s) AS ?count) WHERE {
  ?s a <${firstClass.type}> .
}`);

    const firstPredicate = schema.predicates[0];
    if (firstPredicate) {
      examples.push(`# Get values of ${className} entities
SELECT ?s ?value WHERE {
  ?s a <${firstClass.type}> .
  ?s <${firstPredicate.predicate}> ?value .
} LIMIT 10`);
    }
  }

  if (examples.length === 0) {
    examples.push(`# Find all entity types
SELECT DISTINCT ?type (COUNT(?s) AS ?count) WHERE {
  ?s a ?type .
} GROUP BY ?type ORDER BY DESC(?count) LIMIT 20`);
  }

  return examples.join("\n\n");
}

export function generateSystemPrompt(
  discoveredSchema: DiscoveredSchema,
  iterationHistory: IterationAttempt[]
): string {
  return `You are a DKG (Decentralized Knowledge Graph) query expert. Convert natural language questions into SPARQL SELECT queries.

## YOUR WORKFLOW

1. **Understand the Question**: Analyze what the user wants to find
2. **Generate SPARQL**: Write a valid SPARQL SELECT query
3. **Execute**: The system validates syntax and adds DKG graph patterns automatically
4. **Iterate if needed**: On failure, use discovery tools and retry with correct predicates

## DISCOVERED SCHEMA (from actual DKG data)

### Available Classes:
${formatClasses(discoveredSchema.classes)}

### Available Predicates:
${formatPredicates(discoveredSchema.predicates)}
${iterationHistory.length > 0 ? formatIterationHistory(iterationHistory) : ""}

## SPARQL SYNTAX GUIDE

Write standard SPARQL SELECT queries. The system wraps them with DKG graph patterns automatically.

### Basic Query:
\`\`\`sparql
SELECT ?s ?name WHERE {
  ?s a <http://schema.org/Product> .
  ?s <http://schema.org/name> ?name .
}
\`\`\`

### With PREFIX:
\`\`\`sparql
PREFIX schema: <http://schema.org/>
SELECT ?s ?name WHERE {
  ?s a schema:Product .
  ?s schema:name ?name .
}
\`\`\`

### COUNT Aggregation:
\`\`\`sparql
SELECT (COUNT(DISTINCT ?s) AS ?count) WHERE {
  ?s a <http://schema.org/Organization> .
}
\`\`\`

### FILTER:
\`\`\`sparql
SELECT ?s ?price WHERE {
  ?s <http://schema.org/price> ?price .
  FILTER(?price > 100)
}
\`\`\`

### ORDER BY and LIMIT:
\`\`\`sparql
SELECT ?s ?name WHERE {
  ?s <http://schema.org/name> ?name .
} ORDER BY ?name LIMIT 10
\`\`\`

## EXAMPLE QUERIES (for your DKG)

${generateExamples(discoveredSchema)}

## DISCOVERY STRATEGY

If a query returns 0 results:
1. Use **discover_classes** to see what entity types exist
2. Use **discover_predicates** with the class URI to find its predicates
3. Use **sample_data** to see actual data structure
4. Retry with correct predicates

## IMPORTANT RULES

1. **Use discovered predicates** - Do NOT invent URIs, use what's in the schema above
2. **Full URIs or PREFIXes** - Always use full URIs or declare PREFIX
3. **Iterate on failure** - If 0 results, discover and retry with different predicates
4. **Keep queries focused** - Start simple, add complexity only if needed
5. **Check error messages** - Syntax errors tell you what's wrong

## AVAILABLE TOOLS

- **execute_sparql**: Execute your SPARQL query string
- **discover_classes**: Find entity types in the DKG
- **discover_predicates**: Find predicates (by class URI or keyword search)
- **sample_data**: Get example data for a class

You have up to 10 iterations. Be systematic and learn from each attempt.`;
}

export const DKG_QUERY_SYSTEM_PROMPT = generateSystemPrompt(
  { classes: [], predicates: [], samples: [] },
  []
);
