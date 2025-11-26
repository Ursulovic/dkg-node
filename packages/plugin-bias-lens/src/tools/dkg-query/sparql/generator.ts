import { Generator, Parser } from "sparqljs";
import type { SelectQuery, SparqlQuery } from "sparqljs";
import type { SelectQueryJson, Pattern } from "./schema.js";

const generator = new Generator();
const parser = new Parser();

export function generateSparql(queryJson: SelectQueryJson): string {
  const query = queryJson as unknown as SelectQuery;
  return generator.stringify(query);
}

export function parseSparql(sparqlString: string): SparqlQuery {
  return parser.parse(sparqlString);
}

export function validateSparql(sparqlString: string): { valid: boolean; error?: string } {
  try {
    parser.parse(sparqlString);
    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function wrapWithDkgGraphPattern(queryJson: SelectQueryJson): SelectQueryJson {
  const dkgPrefix = "https://ontology.origintrail.io/dkg/1.0#";

  const currentGraphPattern: Pattern = {
    type: "graph",
    name: { termType: "NamedNode", value: "current:graph" },
    patterns: [
      {
        type: "bgp",
        triples: [
          {
            subject: { termType: "Variable", value: "dkgGraphRef" },
            predicate: { termType: "NamedNode", value: `${dkgPrefix}hasNamedGraph` },
            object: { termType: "Variable", value: "dkgContainedGraph" },
          },
        ],
      },
    ],
  };

  const contentGraphPattern: Pattern = {
    type: "graph",
    name: { termType: "Variable", value: "dkgContainedGraph" },
    patterns: queryJson.where as Pattern[],
  };

  const updatedPrefixes = {
    ...queryJson.prefixes,
    dkg: dkgPrefix,
  };

  return {
    ...queryJson,
    prefixes: updatedPrefixes,
    where: [currentGraphPattern, contentGraphPattern],
  };
}

export function createSimpleSelectQuery(
  variables: string[],
  triples: Array<{ subject: string; predicate: string; object: string }>,
  prefixes: Record<string, string> = {}
): SelectQueryJson {
  return {
    queryType: "SELECT",
    variables: variables.map((v) => ({
      termType: "Variable" as const,
      value: v.startsWith("?") ? v.slice(1) : v,
    })),
    where: [
      {
        type: "bgp",
        triples: triples.map((t) => ({
          subject: parseTermString(t.subject),
          predicate: parseTermString(t.predicate),
          object: parseTermString(t.object),
        })),
      },
    ],
    prefixes,
  };
}

function parseTermString(
  term: string
): { termType: "Variable"; value: string } | { termType: "NamedNode"; value: string } {
  if (term.startsWith("?")) {
    return { termType: "Variable", value: term.slice(1) };
  }
  return { termType: "NamedNode", value: term };
}

export function wrapSparqlStringWithDkgPattern(sparqlString: string): {
  success: boolean;
  sparql?: string;
  error?: string;
} {
  try {
    const parsed = parser.parse(sparqlString);

    if (parsed.type !== "query" || parsed.queryType !== "SELECT") {
      return { success: false, error: "Only SELECT queries are supported" };
    }

    const selectQuery = parsed as SelectQuery;
    const wrapped = wrapWithDkgGraphPattern(selectQuery as unknown as SelectQueryJson);
    const result = generator.stringify(wrapped as unknown as SelectQuery);

    return { success: true, sparql: result };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
