import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { Document } from "@langchain/core/documents";
import { getSchemaVectorStore } from "../../schema/index.js";
import type { DocumentMetadata } from "../../schema/types.js";

export const createSearchSchemaTool = () =>
  tool(
    async ({ query, namespaces }) => {
      if (!query || query.trim().length === 0) {
        return JSON.stringify({ error: "Query string is required" });
      }

      try {
        const store = await getSchemaVectorStore();

        const results = await store.searchWithScore(query, 15, namespaces);

        if (results.length === 0) {
          return JSON.stringify({
            results: [],
            message: "No matching classes or properties found. Try a different query.",
          });
        }

        return JSON.stringify({
          results: results.map(([doc]) => doc.pageContent),
        });
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "search_schema",
      description: `Search ontology schema for classes and properties using semantic search.

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
- Finding product classes: query="product item", namespaces=["schema"]
- Finding person properties: query="person name", namespaces=["schema", "foaf"]
- Finding any review-related: query="review rating" (searches all)
- Finding RDF primitives: query="class property", namespaces=["rdf", "rdfs"]
- Finding bias reports: query="claim review bias rating"

Returns detailed information including:
- Class hierarchies (e.g., Review → CreativeWork → Thing)
- Direct and inherited properties with their types
- SPARQL usage examples

Use this BEFORE writing any SPARQL query to find the correct URIs and properties.`,
      schema: z.object({
        query: z
          .string()
          .describe(
            "Natural language query to search for classes and properties (e.g., 'review rating' to find Review class and rating properties)"
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
