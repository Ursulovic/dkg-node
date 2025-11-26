import { config } from "dotenv";
import { join, dirname } from "path";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  rmSync,
} from "fs";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
// @ts-expect-error No types for dkg.js
import DKG from "dkg.js";

import type {
  ClassInfo,
  PredicateInfo,
  Checkpoint,
  SerializedDocument,
  ClassDocumentMetadata,
} from "../src/tools/dkg-query/schema/types.js";

config({ path: join(process.cwd(), "../../apps/agent/.env") });

const BATCH_SIZE = 10;
const OUTPUT_DIR = "src/tools/dkg-query/schema";
const SCHEMA_ORG_JSONLD = "https://schema.org/version/latest/schemaorg-current-https.jsonld";

const otnodeUrl = new URL(process.env.DKG_OTNODE_URL!);

const dkg = new DKG({
  endpoint: `${otnodeUrl.protocol}//${otnodeUrl.hostname}`,
  port: otnodeUrl.port || "8900",
  blockchain: {
    name: process.env.DKG_BLOCKCHAIN,
    privateKey: process.env.DKG_PUBLISH_WALLET,
  },
  maxNumberOfRetries: 300,
  frequency: 2,
  contentType: "all",
  nodeApiVersion: "/v1",
});

let schemaOrgCache: Map<string, string> | null = null;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const str = String(value);
  const match = str.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function extractLabel(uri: string): string {
  return uri.split(/[/#]/).pop() || uri;
}

function extractNamespace(uri: string): string {
  const lastSlash = uri.lastIndexOf("/");
  const lastHash = uri.lastIndexOf("#");
  const splitIndex = Math.max(lastSlash, lastHash);
  return splitIndex > 0 ? uri.substring(0, splitIndex + 1) : uri;
}

async function loadSchemaOrgDescriptions(): Promise<Map<string, string>> {
  if (schemaOrgCache) return schemaOrgCache;

  console.log("Loading schema.org definitions...");
  const response = await fetch(SCHEMA_ORG_JSONLD);
  const data = await response.json();

  schemaOrgCache = new Map();
  for (const item of data["@graph"]) {
    if (item["@id"] && item["rdfs:comment"]) {
      const comment =
        typeof item["rdfs:comment"] === "string"
          ? item["rdfs:comment"]
          : item["rdfs:comment"]["@value"];
      schemaOrgCache.set(item["@id"], comment);
    }
  }

  console.log(`  Loaded ${schemaOrgCache.size} schema.org definitions`);
  return schemaOrgCache;
}

function getClassDescription(
  uri: string,
  schemaOrg: Map<string, string>
): string | undefined {
  if (schemaOrg.has(uri)) return schemaOrg.get(uri);

  const label = extractLabel(uri);
  const variations = [
    `schema:${label}`,
    `https://schema.org/${label}`,
    `http://schema.org/${label}`,
  ];

  for (const variant of variations) {
    if (schemaOrg.has(variant)) return schemaOrg.get(variant);
  }

  return undefined;
}

function loadOrCreateCheckpoint(): Checkpoint {
  const checkpointPath = join(OUTPUT_DIR, "progress/checkpoint.json");

  if (existsSync(checkpointPath)) {
    const checkpoint = JSON.parse(
      readFileSync(checkpointPath, "utf-8")
    ) as Checkpoint;
    return checkpoint;
  }

  return {
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    totalClasses: 0,
    processedCount: 0,
    processedUris: [],
    status: "in_progress",
  };
}

function saveCheckpoint(checkpoint: Checkpoint): void {
  const checkpointPath = join(OUTPUT_DIR, "progress/checkpoint.json");
  mkdirSync(dirname(checkpointPath), { recursive: true });
  writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
}

function appendDocument(doc: Document<ClassDocumentMetadata>): void {
  const docsPath = join(OUTPUT_DIR, "progress/documents.jsonl");
  mkdirSync(dirname(docsPath), { recursive: true });
  const serialized: SerializedDocument = {
    pageContent: doc.pageContent,
    metadata: doc.metadata,
  };
  appendFileSync(docsPath, JSON.stringify(serialized) + "\n");
}

function loadSavedDocuments(): Document<ClassDocumentMetadata>[] {
  const docsPath = join(OUTPUT_DIR, "progress/documents.jsonl");
  if (!existsSync(docsPath)) return [];

  const content = readFileSync(docsPath, "utf-8").trim();
  if (!content) return [];

  const lines = content.split("\n");
  return lines.filter(Boolean).map((line) => {
    const data = JSON.parse(line) as SerializedDocument;
    return new Document<ClassDocumentMetadata>({
      pageContent: data.pageContent,
      metadata: data.metadata,
    });
  });
}

async function fetchAllClasses(): Promise<ClassInfo[]> {
  const query = `
    PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
    SELECT DISTINCT ?type (COUNT(?s) as ?count) WHERE {
      GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
      GRAPH ?kaGraph { ?s a ?type . }
    }
    GROUP BY ?type
    ORDER BY DESC(?count)
  `;

  const result = await dkg.graph.query(query, "SELECT");
  return result.data.map((row: Record<string, unknown>) => ({
    uri: String(row.type),
    count: extractNumber(row.count),
  }));
}

async function fetchPredicatesForClass(
  classUri: string
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
    const result = await dkg.graph.query(query, "SELECT");
    return result.data.map((row: Record<string, unknown>) => ({
      uri: String(row.predicate),
      label: extractLabel(String(row.predicate)),
      usageCount: extractNumber(row.count),
    }));
  } catch {
    return [];
  }
}

async function buildClassDocument(
  cls: ClassInfo,
  schemaOrgDescriptions: Map<string, string>
): Promise<Document<ClassDocumentMetadata>> {
  const predicates = await fetchPredicatesForClass(cls.uri);
  const label = extractLabel(cls.uri);
  const namespace = extractNamespace(cls.uri);
  const description = getClassDescription(cls.uri, schemaOrgDescriptions);

  const predicateLabels = predicates.map((p) => p.label).join(", ");

  const pageContent = `${label} (${namespace})
${description || "No description available."}
Predicates: ${predicateLabels || "none discovered"}
Instance count: ${cls.count}`;

  return new Document<ClassDocumentMetadata>({
    pageContent,
    metadata: {
      uri: cls.uri,
      label,
      description,
      namespace,
      instanceCount: cls.count,
      predicates,
      fetchedAt: new Date().toISOString(),
    },
  });
}

async function main() {
  console.log("\n=== DKG Schema Cache Builder ===\n");

  const forceRebuild = process.argv.includes("--force");

  if (forceRebuild) {
    console.log("Force rebuild: clearing existing progress...\n");
    rmSync(join(OUTPUT_DIR, "progress"), { recursive: true, force: true });
    rmSync(join(OUTPUT_DIR, "dkg-schema-index"), { recursive: true, force: true });
  }

  const checkpoint = loadOrCreateCheckpoint();
  const processedSet = new Set(checkpoint.processedUris);

  if (checkpoint.status === "completed" && !forceRebuild) {
    console.log("Cache already complete. Use --force to rebuild.");
    return;
  }

  if (checkpoint.processedCount > 0) {
    console.log(
      `Resuming: ${checkpoint.processedCount} classes already processed\n`
    );
  }

  const schemaOrgDescriptions = await loadSchemaOrgDescriptions();

  console.log("\nFetching all classes from DKG...");
  const startFetch = Date.now();
  const allClasses = await fetchAllClasses();
  console.log(
    `  Found ${allClasses.length} classes total (${((Date.now() - startFetch) / 1000).toFixed(1)}s)`
  );

  const classesToProcess = allClasses.filter(
    (cls) => !processedSet.has(cls.uri)
  );
  console.log(`  ${classesToProcess.length} classes remaining to process\n`);

  if (classesToProcess.length === 0 && checkpoint.processedCount > 0) {
    console.log("All classes already processed. Building final index...\n");
  } else {
    checkpoint.totalClasses = allClasses.length;

    const totalBatches = Math.ceil(classesToProcess.length / BATCH_SIZE);

    for (let i = 0; i < classesToProcess.length; i += BATCH_SIZE) {
      const batch = classesToProcess.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      console.log(`Processing batch ${batchNum}/${totalBatches}...`);

      try {
        const batchDocs = await Promise.all(
          batch.map((cls) => buildClassDocument(cls, schemaOrgDescriptions))
        );

        for (const doc of batchDocs) {
          appendDocument(doc);
          checkpoint.processedUris.push(doc.metadata.uri);
          checkpoint.processedCount++;

          const predicateCount = doc.metadata.predicates?.length || 0;
          console.log(`  ✓ ${doc.metadata.label} (${predicateCount} predicates)`);
        }

        checkpoint.lastUpdatedAt = new Date().toISOString();
        saveCheckpoint(checkpoint);
      } catch (error) {
        checkpoint.status = "failed";
        checkpoint.lastError =
          error instanceof Error ? error.message : String(error);
        saveCheckpoint(checkpoint);
        console.error(`\n❌ Batch failed: ${checkpoint.lastError}`);
        console.log("Progress saved. Run again to resume.\n");
        throw error;
      }

      if (i + BATCH_SIZE < classesToProcess.length) {
        await sleep(1000);
      }
    }
  }

  console.log("\nBuilding vector index from all documents...");
  const allDocuments = loadSavedDocuments();
  console.log(`  Embedding ${allDocuments.length} documents...`);

  const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });
  const vectorStore = await FaissStore.fromDocuments(allDocuments, embeddings);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  await vectorStore.save(join(OUTPUT_DIR, "dkg-schema-index"));

  checkpoint.status = "completed";
  checkpoint.lastUpdatedAt = new Date().toISOString();
  saveCheckpoint(checkpoint);

  const totalPredicates = allDocuments.reduce(
    (sum, doc) => sum + (doc.metadata.predicates?.length || 0),
    0
  );

  console.log(`\n✓ Schema cache saved to ${OUTPUT_DIR}/dkg-schema-index/`);
  console.log(`  - ${allDocuments.length} classes indexed`);
  console.log(`  - ${totalPredicates} total predicates`);
  console.log(`\nProgress files can be deleted: rm -rf ${OUTPUT_DIR}/progress/`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
