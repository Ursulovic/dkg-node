import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Document } from "@langchain/core/documents";
import { getSchemaVectorStore } from "../../schema/index.js";
import type { DocumentMetadata } from "../../schema/types.js";

export const createSearchSchemaTool = () =>
  tool(
    async ({ keywords, namespaces }) => {
      if (keywords.length === 0) {
        return JSON.stringify({ error: "At least one keyword is required" });
      }

      try {
        const store = await getSchemaVectorStore();

        const allResults = new Map<
          string,
          { doc: Document<DocumentMetadata>; score: number }
        >();

        for (const keyword of keywords) {
          const results = await store.searchWithScore(keyword, 10, namespaces);
          for (const [doc, score] of results) {
            const existing = allResults.get(doc.metadata.uri);
            if (!existing || score < existing.score) {
              allResults.set(doc.metadata.uri, { doc, score });
            }
          }
        }

        const sorted = [...allResults.values()]
          .sort((a, b) => a.score - b.score)
          .slice(0, 15);

        if (sorted.length === 0) {
          return JSON.stringify({
            results: [],
            message: "No matching classes or properties found. Try different keywords.",
          });
        }

        return JSON.stringify({
          results: sorted.map(({ doc }) => doc.pageContent),
        });
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "search_schema",
      description: `Search ontology schema for classes and properties by keywords.

AVAILABLE NAMESPACES (use symbol as value):
- "schema" - Schema.org vocabulary (Product, Review, Person, Organization, etc.)
- "rdf" - RDF syntax (type, Property, Statement)
- "rdfs" - RDF Schema (Class, subClassOf, label, comment)
- "owl" - OWL (ObjectProperty, DatatypeProperty, equivalentClass)
- "dcterms" - Dublin Core Terms (creator, title, description, modified)
- "dcelems" - Dublin Core Elements (title, creator, subject, description)
- "foaf" - Friend of a Friend (Person, name, knows, mbox)
- "skos" - SKOS (Concept, broader, narrower, prefLabel)
- "prov" - Provenance (Entity, Activity, wasGeneratedBy)
- "as" - Activity Streams (Activity, Object, Actor)
- "shacl" - SHACL (NodeShape, PropertyShape, path)
- "xsd" - XML Schema Datatypes (string, integer, dateTime)
- "ld" - JSON-LD (context, id, type)

USAGE:
- Omit 'namespaces' to search ALL ontologies
- Specify namespaces array to search specific ontologies only

EXAMPLES:
- Finding product classes: keywords=["product", "item"], namespaces=["schema"]
- Finding person properties: keywords=["person", "name"], namespaces=["schema", "foaf"]
- Finding any review-related: keywords=["review", "rating"] (searches all)
- Finding RDF primitives: keywords=["class", "property"], namespaces=["rdf", "rdfs"]

Returns detailed information including:
- Class hierarchies (e.g., Review → CreativeWork → Thing)
- Direct and inherited properties with their types
- SPARQL usage examples

Use this BEFORE writing any SPARQL query to find the correct URIs and properties.`,
      schema: z.object({
        keywords: z
          .array(z.string())
          .min(1)
          .describe(
            "Keywords to search for (e.g., ['review', 'rating'] to find Review class and rating properties)"
          ),
        namespaces: z
          .array(z.string())
          .optional()
          .describe(
            "Ontology namespaces to search (e.g., ['schema', 'foaf']). Omit to search all ontologies."
          ),
      }),
    }
  );
