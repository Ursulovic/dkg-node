import { config } from "dotenv";
import { join } from "path";
import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  rmSync,
  statSync,
} from "fs";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { Parser, Store, DataFactory } from "n3";

import type {
  OntologyClass,
  OntologyProperty,
  ClassDocumentMetadata,
  PropertyDocumentMetadata,
} from "../src/tools/dkg-query/schema/types.js";

config({ path: join(process.cwd(), "../../apps/agent/.env") });

const { namedNode } = DataFactory;

const ONTOLOGY_DIR = "src/tools/dkg-query/schema/ontologies";
const INDICES_DIR = "src/tools/dkg-query/schema/indices";

const RDF_TYPE = namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const RDF_PROPERTY = namedNode(
  "http://www.w3.org/1999/02/22-rdf-syntax-ns#Property"
);
const RDFS_CLASS = namedNode("http://www.w3.org/2000/01/rdf-schema#Class");
const RDFS_LABEL = namedNode("http://www.w3.org/2000/01/rdf-schema#label");
const RDFS_COMMENT = namedNode("http://www.w3.org/2000/01/rdf-schema#comment");
const RDFS_DOMAIN = namedNode("http://www.w3.org/2000/01/rdf-schema#domain");
const RDFS_RANGE = namedNode("http://www.w3.org/2000/01/rdf-schema#range");
const RDFS_SUBCLASS = namedNode(
  "http://www.w3.org/2000/01/rdf-schema#subClassOf"
);
const OWL_CLASS = namedNode("http://www.w3.org/2002/07/owl#Class");
const OWL_OBJECT_PROPERTY = namedNode(
  "http://www.w3.org/2002/07/owl#ObjectProperty"
);
const OWL_DATATYPE_PROPERTY = namedNode(
  "http://www.w3.org/2002/07/owl#DatatypeProperty"
);

interface OntologyMeta {
  name: string;
  symbol: string;
  ns: string;
  lov?: string;
  source?: string;
}

function extractLabel(uri: string): string {
  return uri.split(/[/#]/).pop() || uri;
}

function getLiteralValue(
  obj: { value: string } | undefined
): string | undefined {
  if (!obj) return undefined;
  return obj.value;
}

function parseSchemaOrgJsonLd(content: string): {
  classes: OntologyClass[];
  properties: OntologyProperty[];
} {
  const data = JSON.parse(content);
  const classes: OntologyClass[] = [];
  const properties: OntologyProperty[] = [];

  for (const item of data["@graph"]) {
    const id = item["@id"];
    if (!id) continue;

    const uri = id.startsWith("schema:")
      ? `https://schema.org/${id.slice(7)}`
      : id;
    const label = item["rdfs:label"] || extractLabel(uri);
    const description =
      typeof item["rdfs:comment"] === "string"
        ? item["rdfs:comment"]
        : item["rdfs:comment"]?.["@value"];

    if (item["@type"] === "rdfs:Class") {
      const parentClassRaw = item["rdfs:subClassOf"];
      let parentClass: string | undefined;
      if (parentClassRaw) {
        const firstParent = Array.isArray(parentClassRaw)
          ? parentClassRaw[0]
          : parentClassRaw;
        if (firstParent) {
          const parentId =
            typeof firstParent === "string" ? firstParent : firstParent["@id"];
          if (parentId && typeof parentId === "string") {
            parentClass = parentId.startsWith("schema:")
              ? `https://schema.org/${parentId.slice(7)}`
              : parentId;
          }
        }
      }

      classes.push({ uri, label, description, parentClass, namespace: "" });
    } else if (item["@type"] === "rdf:Property") {
      const domainRaw = item["schema:domainIncludes"];
      const rangeRaw = item["schema:rangeIncludes"];

      const domain = (
        Array.isArray(domainRaw) ? domainRaw : domainRaw ? [domainRaw] : []
      ).map((d: { "@id": string } | string) => {
        const did = typeof d === "string" ? d : d["@id"];
        return did.startsWith("schema:")
          ? `https://schema.org/${did.slice(7)}`
          : did;
      });

      const range = (
        Array.isArray(rangeRaw) ? rangeRaw : rangeRaw ? [rangeRaw] : []
      ).map((r: { "@id": string } | string) => {
        const rid = typeof r === "string" ? r : r["@id"];
        return rid.startsWith("schema:")
          ? `https://schema.org/${rid.slice(7)}`
          : rid;
      });

      properties.push({ uri, label, description, domain, range, namespace: "" });
    }
  }

  return { classes, properties };
}

function parseTurtleOntology(content: string): {
  classes: OntologyClass[];
  properties: OntologyProperty[];
} {
  const parser = new Parser();
  const store = new Store(parser.parse(content));
  const classes: OntologyClass[] = [];
  const properties: OntologyProperty[] = [];

  for (const quad of store.match(null, RDF_TYPE, RDFS_CLASS)) {
    const uri = quad.subject.value;
    const labelQuad = store.getObjects(quad.subject, RDFS_LABEL, null)[0];
    const commentQuad = store.getObjects(quad.subject, RDFS_COMMENT, null)[0];
    const parentQuad = store.getObjects(quad.subject, RDFS_SUBCLASS, null)[0];

    classes.push({
      uri,
      label: getLiteralValue(labelQuad) || extractLabel(uri),
      description: getLiteralValue(commentQuad),
      parentClass: parentQuad?.value,
      namespace: "",
    });
  }

  for (const quad of store.match(null, RDF_TYPE, OWL_CLASS)) {
    const uri = quad.subject.value;
    if (classes.some((c) => c.uri === uri)) continue;

    const labelQuad = store.getObjects(quad.subject, RDFS_LABEL, null)[0];
    const commentQuad = store.getObjects(quad.subject, RDFS_COMMENT, null)[0];
    const parentQuad = store.getObjects(quad.subject, RDFS_SUBCLASS, null)[0];

    classes.push({
      uri,
      label: getLiteralValue(labelQuad) || extractLabel(uri),
      description: getLiteralValue(commentQuad),
      parentClass: parentQuad?.value,
      namespace: "",
    });
  }

  for (const quad of store.match(null, RDF_TYPE, RDF_PROPERTY)) {
    const uri = quad.subject.value;
    const labelQuad = store.getObjects(quad.subject, RDFS_LABEL, null)[0];
    const commentQuad = store.getObjects(quad.subject, RDFS_COMMENT, null)[0];
    const domainQuads = store.getObjects(quad.subject, RDFS_DOMAIN, null);
    const rangeQuads = store.getObjects(quad.subject, RDFS_RANGE, null);

    properties.push({
      uri,
      label: getLiteralValue(labelQuad) || extractLabel(uri),
      description: getLiteralValue(commentQuad),
      domain: domainQuads.map((d) => d.value),
      range: rangeQuads.map((r) => r.value),
      namespace: "",
    });
  }

  for (const quad of store.match(null, RDF_TYPE, OWL_OBJECT_PROPERTY)) {
    const uri = quad.subject.value;
    if (properties.some((p) => p.uri === uri)) continue;

    const labelQuad = store.getObjects(quad.subject, RDFS_LABEL, null)[0];
    const commentQuad = store.getObjects(quad.subject, RDFS_COMMENT, null)[0];
    const domainQuads = store.getObjects(quad.subject, RDFS_DOMAIN, null);
    const rangeQuads = store.getObjects(quad.subject, RDFS_RANGE, null);

    properties.push({
      uri,
      label: getLiteralValue(labelQuad) || extractLabel(uri),
      description: getLiteralValue(commentQuad),
      domain: domainQuads.map((d) => d.value),
      range: rangeQuads.map((r) => r.value),
      namespace: "",
    });
  }

  for (const quad of store.match(null, RDF_TYPE, OWL_DATATYPE_PROPERTY)) {
    const uri = quad.subject.value;
    if (properties.some((p) => p.uri === uri)) continue;

    const labelQuad = store.getObjects(quad.subject, RDFS_LABEL, null)[0];
    const commentQuad = store.getObjects(quad.subject, RDFS_COMMENT, null)[0];
    const domainQuads = store.getObjects(quad.subject, RDFS_DOMAIN, null);
    const rangeQuads = store.getObjects(quad.subject, RDFS_RANGE, null);

    properties.push({
      uri,
      label: getLiteralValue(labelQuad) || extractLabel(uri),
      description: getLiteralValue(commentQuad),
      domain: domainQuads.map((d) => d.value),
      range: rangeQuads.map((r) => r.value),
      namespace: "",
    });
  }

  return { classes, properties };
}

function buildClassHierarchy(
  classes: OntologyClass[]
): Map<string, string[]> {
  const classMap = new Map(classes.map((c) => [c.uri, c]));
  const hierarchy = new Map<string, string[]>();

  for (const cls of classes) {
    const chain: string[] = [];
    let current = cls.parentClass;
    const visited = new Set<string>();

    while (current && classMap.has(current) && !visited.has(current)) {
      visited.add(current);
      chain.push(current);
      current = classMap.get(current)?.parentClass;
    }

    hierarchy.set(cls.uri, chain);
  }

  return hierarchy;
}

function collectPropertiesPerClass(
  classes: OntologyClass[],
  properties: OntologyProperty[],
  hierarchy: Map<string, string[]>
): Map<
  string,
  { direct: OntologyProperty[]; inherited: Map<string, OntologyProperty[]> }
> {
  const result = new Map<
    string,
    { direct: OntologyProperty[]; inherited: Map<string, OntologyProperty[]> }
  >();

  for (const cls of classes) {
    const classChain = [cls.uri, ...(hierarchy.get(cls.uri) || [])];
    const direct: OntologyProperty[] = [];
    const inherited = new Map<string, OntologyProperty[]>();

    for (const prop of properties) {
      for (const domain of prop.domain) {
        if (domain === cls.uri) {
          direct.push(prop);
        } else if (classChain.includes(domain)) {
          if (!inherited.has(domain)) inherited.set(domain, []);
          inherited.get(domain)!.push(prop);
        }
      }
    }

    result.set(cls.uri, { direct, inherited });
  }

  return result;
}

function buildClassDocument(
  cls: OntologyClass,
  meta: OntologyMeta,
  hierarchyChain: string[],
  props:
    | { direct: OntologyProperty[]; inherited: Map<string, OntologyProperty[]> }
    | undefined
): Document<ClassDocumentMetadata> {
  const lines: string[] = [];

  lines.push(`Class: ${cls.label} (${cls.uri})`);
  lines.push(`Ontology: ${meta.name} (${meta.symbol})`);
  lines.push(`Namespace: ${meta.ns}`);

  if (meta.ns === "http://schema.org/") {
    const httpsUri = cls.uri.replace("http://", "https://");
    lines.push(`Also known as: ${httpsUri}`);
  }

  if (cls.description) {
    lines.push(`Description: ${cls.description}`);
  }

  if (hierarchyChain.length > 0) {
    const hierarchyLabels = hierarchyChain.map(extractLabel);
    lines.push(`\nHierarchy: ${cls.label} → ${hierarchyLabels.join(" → ")}`);
  }

  if (props) {
    if (props.direct.length > 0) {
      lines.push(`\nDirect properties:`);
      for (const prop of props.direct) {
        const rangeLabels = prop.range.map(extractLabel).join(", ") || "any";
        lines.push(`- ${prop.label} (${rangeLabels})`);
      }
    }

    for (const [parentUri, parentProps] of props.inherited) {
      const parentLabel = extractLabel(parentUri);
      lines.push(`\nInherited from ${parentLabel}:`);
      for (const prop of parentProps) {
        const rangeLabels = prop.range.map(extractLabel).join(", ") || "any";
        lines.push(`- ${prop.label} (${rangeLabels})`);
      }
    }
  }

  lines.push(`\nSPARQL: Use <${cls.uri}>`);

  return new Document<ClassDocumentMetadata>({
    pageContent: lines.join("\n"),
    metadata: {
      uri: cls.uri,
      label: cls.label,
      description: cls.description,
      namespace: meta.ns,
      type: "class",
      hierarchy: hierarchyChain,
      fetchedAt: new Date().toISOString(),
    },
  });
}

function buildPropertyDocument(
  prop: OntologyProperty,
  meta: OntologyMeta
): Document<PropertyDocumentMetadata> {
  const lines: string[] = [];

  lines.push(`Property: ${prop.label} (${prop.uri})`);
  lines.push(`Ontology: ${meta.name} (${meta.symbol})`);
  lines.push(`Namespace: ${meta.ns}`);

  if (prop.description) {
    lines.push(`Description: ${prop.description}`);
  }

  if (prop.domain.length > 0) {
    const domainLabels = prop.domain.map(extractLabel).join(", ");
    lines.push(`Used by: ${domainLabels}`);
  }

  if (prop.range.length > 0) {
    const rangeLabels = prop.range.map(extractLabel).join(", ");
    lines.push(`Expects: ${rangeLabels}`);
  }

  lines.push(`\nSPARQL: ?entity <${prop.uri}> ?value .`);

  return new Document<PropertyDocumentMetadata>({
    pageContent: lines.join("\n"),
    metadata: {
      uri: prop.uri,
      label: prop.label,
      description: prop.description,
      namespace: meta.ns,
      type: "property",
      domain: prop.domain,
      range: prop.range,
      fetchedAt: new Date().toISOString(),
    },
  });
}

async function main() {
  console.log("\n=== Ontology Vector Store Builder ===\n");

  const previewMode = process.argv.includes("--preview");
  const forceRebuild = process.argv.includes("--force");

  if (forceRebuild) {
    console.log("Force rebuild: clearing existing indices...\n");
    rmSync(INDICES_DIR, { recursive: true, force: true });
  }

  if (!existsSync(ONTOLOGY_DIR)) {
    console.error(`Ontologies directory not found: ${ONTOLOGY_DIR}`);
    console.error(
      "Please download ontologies from https://github.com/ontola/ontologies/tree/master/ontologies"
    );
    process.exit(1);
  }

  const ontologyDirs = readdirSync(ONTOLOGY_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (ontologyDirs.length === 0) {
    console.error("No ontology subdirectories found.");
    process.exit(1);
  }

  console.log(`Found ${ontologyDirs.length} ontology directories\n`);

  const embeddings = previewMode
    ? null
    : new OpenAIEmbeddings({ model: "text-embedding-3-small" });

  let totalClasses = 0;
  let totalProperties = 0;
  let totalIndices = 0;

  for (const dir of ontologyDirs) {
    const indexPath = join(ONTOLOGY_DIR, dir, "index.json");
    const ttlPath = join(ONTOLOGY_DIR, dir, "ontology.ttl");
    const jsonldPath = join(ONTOLOGY_DIR, dir, "ontology.jsonld");

    if (!existsSync(indexPath)) {
      console.log(`Skipping ${dir} - no index.json found`);
      continue;
    }

    const meta: OntologyMeta = JSON.parse(readFileSync(indexPath, "utf-8"));

    console.log("=".repeat(60));
    console.log(`ONTOLOGY: ${meta.name} (${meta.symbol})`);
    console.log(`Namespace: ${meta.ns}`);
    console.log("=".repeat(60));

    let classes: OntologyClass[];
    let properties: OntologyProperty[];

    if (existsSync(jsonldPath)) {
      console.log(`  Parsing JSON-LD...`);
      const content = readFileSync(jsonldPath, "utf-8");
      ({ classes, properties } = parseSchemaOrgJsonLd(content));
    } else if (existsSync(ttlPath)) {
      console.log(`  Parsing Turtle...`);
      const content = readFileSync(ttlPath, "utf-8");
      ({ classes, properties } = parseTurtleOntology(content));
    } else {
      console.log(`  Skipping - no ontology file found\n`);
      continue;
    }

    if (classes.length === 0 && properties.length === 0) {
      console.log(`  No classes or properties found\n`);
      continue;
    }

    console.log(`  Found ${classes.length} classes, ${properties.length} properties`);

    const hierarchy = buildClassHierarchy(classes);
    const classProperties = collectPropertiesPerClass(
      classes,
      properties,
      hierarchy
    );

    const documents: Document<ClassDocumentMetadata | PropertyDocumentMetadata>[] = [];

    for (const cls of classes) {
      const props = classProperties.get(cls.uri);
      const hierarchyChain = hierarchy.get(cls.uri) || [];
      const doc = buildClassDocument(cls, meta, hierarchyChain, props);
      documents.push(doc);

      if (previewMode) {
        console.log(`\n--- CLASS: ${cls.label} ---`);
        console.log(doc.pageContent);
      }
    }

    for (const prop of properties) {
      const doc = buildPropertyDocument(prop, meta);
      documents.push(doc);

      if (previewMode) {
        console.log(`\n--- PROPERTY: ${prop.label} ---`);
        console.log(doc.pageContent);
      }
    }

    totalClasses += classes.length;
    totalProperties += properties.length;

    if (!previewMode && embeddings && documents.length > 0) {
      console.log(`  Embedding ${documents.length} documents...`);
      const vectorStore = await FaissStore.fromDocuments(documents, embeddings);

      mkdirSync(INDICES_DIR, { recursive: true });
      await vectorStore.save(join(INDICES_DIR, meta.symbol));
      console.log(`  ✓ Index saved to indices/${meta.symbol}/`);
      totalIndices++;
    }

    console.log();
  }

  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total classes: ${totalClasses}`);
  console.log(`Total properties: ${totalProperties}`);

  if (previewMode) {
    console.log(
      "\n[Preview mode] No indices created. Run without --preview to build."
    );
  } else {
    console.log(`\n✓ Created ${totalIndices} separate indices in ${INDICES_DIR}/`);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
