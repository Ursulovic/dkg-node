import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { DkgClient } from "../../types.js";
import { validateSparql, wrapSparqlStringWithDkgPattern } from "../../sparql/generator.js";

type OntologyType = "schema" | "prov" | "dcterms" | "foaf" | "skos" | "owl" | "generic";

function detectOntologyFromUri(uri: string): OntologyType {
  if (uri.includes("schema.org")) return "schema";
  if (uri.includes("w3.org/ns/prov")) return "prov";
  if (uri.includes("purl.org/dc/terms") || uri.includes("purl.org/dc/elements")) return "dcterms";
  if (uri.includes("xmlns.com/foaf")) return "foaf";
  if (uri.includes("w3.org/2004/02/skos")) return "skos";
  if (uri.includes("w3.org/2002/07/owl")) return "owl";
  return "generic";
}

function buildDiscoveryQuery(classUri: string, ontologyType: OntologyType): string {
  switch (ontologyType) {
    case "schema":
      return `
        SELECT DISTINCT ?propertyID (COUNT(?instance) as ?usage) WHERE {
          ?instance a <${classUri}> .
          ?instance <http://schema.org/additionalProperty> ?prop .
          ?prop <http://schema.org/propertyID> ?propertyID .
        }
        GROUP BY ?propertyID
        ORDER BY DESC(?usage)
      `;

    case "prov":
      return `
        SELECT DISTINCT ?property WHERE {
          ?entity a <${classUri}> .
          ?entity ?property ?value .
          FILTER(!STRSTARTS(STR(?property), "http://www.w3.org/ns/prov#"))
          FILTER(!STRSTARTS(STR(?property), "http://www.w3.org/1999/02/22-rdf-syntax-ns#"))
        }
      `;

    case "dcterms":
      return `
        SELECT DISTINCT ?property ?superProperty WHERE {
          ?instance a <${classUri}> .
          ?instance ?property ?value .
          OPTIONAL { ?property <http://www.w3.org/2000/01/rdf-schema#subPropertyOf> ?superProperty }
          FILTER(STRSTARTS(STR(?property), "http://purl.org/dc/"))
        }
      `;

    case "foaf":
      return `
        SELECT DISTINCT ?property WHERE {
          ?instance a <${classUri}> .
          ?instance ?property ?value .
          FILTER(STRSTARTS(STR(?property), "http://xmlns.com/foaf/"))
        }
      `;

    case "skos":
      return `
        SELECT DISTINCT ?property WHERE {
          ?concept a <${classUri}> .
          ?concept ?property ?value .
          FILTER(
            STRSTARTS(STR(?property), "http://www.w3.org/2004/02/skos/") ||
            STRSTARTS(STR(?property), "http://rdf-vocabulary.ddialliance.org/xkos#")
          )
        }
      `;

    case "owl":
      return `
        SELECT DISTINCT ?equivalent WHERE {
          {
            <${classUri}> <http://www.w3.org/2002/07/owl#equivalentClass> ?equivalent .
          } UNION {
            ?equivalent <http://www.w3.org/2002/07/owl#equivalentClass> <${classUri}> .
          }
        }
      `;

    default:
      return `
        SELECT DISTINCT ?property (COUNT(?instance) as ?usage) WHERE {
          ?instance a <${classUri}> .
          ?instance ?property ?value .
        }
        GROUP BY ?property
        ORDER BY DESC(?usage)
      `;
  }
}

export const createDiscoverExtensionsTool = (dkgClient: DkgClient) =>
  tool(
    async ({ classUri }) => {
      const ontologyType = detectOntologyFromUri(classUri);
      const sparql = buildDiscoveryQuery(classUri, ontologyType);

      const validation = validateSparql(sparql);
      if (!validation.valid) {
        return JSON.stringify({
          error: `Invalid SPARQL: ${validation.error}`,
          classUri,
          detectedOntology: ontologyType,
        });
      }

      const wrapped = wrapSparqlStringWithDkgPattern(sparql);
      if (!wrapped.success) {
        return JSON.stringify({
          error: `Wrap failed: ${wrapped.error}`,
          classUri,
          detectedOntology: ontologyType,
        });
      }

      try {
        const result = await dkgClient.graph.query(wrapped.sparql!, "SELECT");
        return JSON.stringify({
          classUri,
          detectedOntology: ontologyType,
          discoveredProperties: result.data || [],
          count: result.data?.length ?? 0,
        });
      } catch (error) {
        return JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          classUri,
          detectedOntology: ontologyType,
        });
      }
    },
    {
      name: "discover_extensions",
      description: `Discover what extension properties exist on instances of a class in the DKG.

AUTO-DETECTS ONTOLOGY from the classUri and uses the appropriate discovery pattern:
- schema.org → discovers additionalProperty/PropertyValue field names
- prov → discovers custom properties on Entity/Activity (non-prov: namespace)
- dcterms → discovers property refinements (rdfs:subPropertyOf)
- foaf → discovers relationship properties
- skos → discovers concept hierarchy properties
- owl → discovers equivalent classes
- generic → discovers all properties used on instances

USE THIS TOOL WHEN:
- User asks "what custom fields does X have?"
- User asks "what properties are used on X instances?"
- You need to find available extension data before querying it

RETURNS: { classUri, detectedOntology, discoveredProperties, count }`,
      schema: z.object({
        classUri: z.string().describe("Full URI of the class to discover extensions for"),
      }),
    }
  );
