import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Document } from "@langchain/core/documents";
import type { DkgClient } from "../../types.js";
import {
  getSchemaVectorStore,
  buildClassDocument,
  extractLabel,
  extractNamespace,
} from "../../schema/index.js";
import type { ClassDocumentMetadata, PredicateInfo } from "../../schema/types.js";

function extractNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const str = String(value);
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export const createSearchSchemaTool = (dkgClient: DkgClient) =>
  tool(
    async ({ keywords }) => {
      if (keywords.length === 0) {
        return JSON.stringify({ error: "At least one keyword is required" });
      }

      try {
        const store = await getSchemaVectorStore();

        const allResults = new Map<
          string,
          { doc: Document<ClassDocumentMetadata>; score: number }
        >();

        for (const keyword of keywords) {
          const results = await store.searchWithScore(keyword, 10);
          for (const [doc, score] of results) {
            const existing = allResults.get(doc.metadata.uri);
            if (!existing || score < existing.score) {
              allResults.set(doc.metadata.uri, { doc, score });
            }
          }
        }

        const sorted = [...allResults.values()]
          .sort((a, b) => a.score - b.score)
          .slice(0, 20);

        if (sorted.length > 0) {
          return JSON.stringify({
            source: "cache",
            classes: sorted.map(({ doc }) => ({
              uri: doc.metadata.uri,
              label: doc.metadata.label,
              description: doc.metadata.description,
              instanceCount: doc.metadata.instanceCount,
              predicates: doc.metadata.predicates,
            })),
          });
        }
      } catch {
        // Vector store not available, fall through to SPARQL
      }

      const filters = keywords
        .map((kw) => `CONTAINS(LCASE(STR(?type)), "${kw.toLowerCase()}")`)
        .join(" || ");

      const query = `
        PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
        SELECT DISTINCT ?type (COUNT(?s) as ?count) WHERE {
          GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
          GRAPH ?kaGraph { ?s a ?type . }
          FILTER(${filters})
        }
        GROUP BY ?type
        ORDER BY DESC(?count)
        LIMIT 20
      `;

      try {
        const result = await dkgClient.graph.query(query, "SELECT");
        const classes = result.data.map((row: Record<string, unknown>) => ({
          uri: String(row.type),
          count: extractNumber(row.count),
        }));

        const classesWithPredicates = await Promise.all(
          classes.map(async (cls) => {
            const predicates = await fetchPredicatesForClass(cls.uri, dkgClient);
            return {
              uri: cls.uri,
              label: extractLabel(cls.uri),
              instanceCount: cls.count,
              predicates,
            };
          })
        );

        cacheNewClasses(classes, dkgClient).catch(() => {});

        return JSON.stringify({
          source: "sparql",
          classes: classesWithPredicates,
        });
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "search_schema",
      description:
        "Search DKG schema for classes by keywords. Returns matching classes with their predicates. Uses cached schema for fast lookup, falls back to SPARQL if needed.",
      schema: z.object({
        keywords: z
          .array(z.string())
          .min(1)
          .describe(
            "Keywords to search for in class names (e.g., ['review', 'claim'] for bias reports)"
          ),
      }),
    }
  );

async function cacheNewClasses(
  classes: { uri: string; count: number }[],
  dkgClient: DkgClient
): Promise<void> {
  const store = await getSchemaVectorStore();

  for (const cls of classes) {
    const predicates = await fetchPredicatesForClass(cls.uri, dkgClient);

    const doc = buildClassDocument(
      cls.uri,
      extractLabel(cls.uri),
      extractNamespace(cls.uri),
      cls.count,
      predicates
    );

    await store.addDocument(doc);
  }
}

async function fetchPredicatesForClass(
  classUri: string,
  dkgClient: DkgClient
): Promise<PredicateInfo[]> {
  const query = `
    PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
    SELECT DISTINCT ?predicate (COUNT(?predicate) as ?count) WHERE {
      GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
      GRAPH ?kaGraph {
        ?s a <${classUri}> .
        ?s ?predicate ?o .
      }
    }
    GROUP BY ?predicate
    ORDER BY DESC(?count)
    LIMIT 50
  `;

  try {
    const result = await dkgClient.graph.query(query, "SELECT");
    return result.data.map((row: Record<string, unknown>) => ({
      uri: String(row.predicate),
      label: extractLabel(String(row.predicate)),
      usageCount: extractNumber(row.count),
    }));
  } catch {
    return [];
  }
}
