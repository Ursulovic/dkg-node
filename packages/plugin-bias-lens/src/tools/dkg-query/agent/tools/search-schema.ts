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

        const results = await store.searchWithPriority(query, 15, namespaces);

        if (results.length === 0) {
          return JSON.stringify({
            results: [],
            message: "No matching classes, properties, or query examples found. Try a different query.",
          });
        }

        return JSON.stringify({
          results: results.map((doc) => doc.pageContent),
        });
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
    {
      name: "search_schema",
      description: `Search ontology schema for classes, properties, and SPARQL query examples using semantic search with priority ranking.

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
- "query-examples" - SPARQL query examples for bias report discovery (PRIORITY-RANKED)

QUERY EXAMPLES NAMESPACE:
The "query-examples" namespace contains 19 validated, working SPARQL query examples for discovering bias reports in the DKG. These examples are PRIORITY-RANKED (1-10, where 10 is highest priority) and will appear FIRST in search results when relevant.

IMPORTANT DKG LIMITATIONS:
- Only DIRECT fields work: @id, @type, name (string)
- Multi-hop queries (nested objects) TIME OUT: itemReviewed.url, reviewRating.ratingValue, isBasedOn.url, about.name, datePublished, keywords, etc.
- Use query-examples to find WORKING query patterns that avoid timeouts

USAGE:
- Omit 'namespaces' to search ALL (ontologies + query examples)
- Specify namespaces=["query-examples"] to ONLY get working query examples
- Combine: namespaces=["schema", "query-examples"] for both ontology + examples

EXAMPLES:
- Find working queries for listing reports: query="list all bias reports", namespaces=["query-examples"]
- Find working queries for topic search: query="find reports about climate", namespaces=["query-examples"]
- Find working queries for counting: query="count reports by topic", namespaces=["query-examples"]
- Find Schema.org classes: query="review rating", namespaces=["schema"]
- Search everything: query="bias report discovery" (searches all)

Returns detailed information including:
- Class hierarchies (e.g., Review → CreativeWork → Thing)
- Direct and inherited properties with their types
- SPARQL usage examples with template and concrete versions
- Query examples are PRIORITY-RANKED to show most relevant first

Use this BEFORE writing any SPARQL query to find correct URIs, properties, and working query patterns.`,
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
