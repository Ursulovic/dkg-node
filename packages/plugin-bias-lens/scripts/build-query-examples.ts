import { config } from "dotenv";
import { join } from "path";
import { existsSync, mkdirSync, rmSync } from "fs";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { loadQueryExamples } from "../src/tools/dkg-query/query-examples/loader.js";

config({ path: join(process.cwd(), "../../apps/agent/.env") });

const EXAMPLES_DIR = "src/tools/dkg-query/examples";
const INDICES_DIR = "src/tools/dkg-query/schema/indices";
const QUERY_INDEX_NAME = "query-examples";

async function main() {
  console.log("\n=== Query Examples Vector Store Builder ===\n");

  const previewMode = process.argv.includes("--preview");
  const forceRebuild = process.argv.includes("--force");

  if (!existsSync(EXAMPLES_DIR)) {
    console.error(`Examples directory not found: ${EXAMPLES_DIR}`);
    process.exit(1);
  }

  console.log(`Loading query examples from ${EXAMPLES_DIR}...`);
  const documents = loadQueryExamples(EXAMPLES_DIR);

  if (documents.length === 0) {
    console.error("No query example documents found.");
    process.exit(1);
  }

  console.log(`Found ${documents.length} query examples\n`);

  if (previewMode) {
    console.log("=".repeat(60));
    console.log("PREVIEW MODE - Document Samples");
    console.log("=".repeat(60));

    for (const doc of documents.slice(0, 3)) {
      console.log(`\n--- ${doc.metadata.id} ---`);
      console.log(`Category: ${doc.metadata.category}`);
      console.log(`Priority: ${doc.metadata.priority}`);
      console.log(`Keywords: ${doc.metadata.keywords.join(", ")}`);
      console.log(`\nContent (first 200 chars):\n${doc.pageContent.substring(0, 200)}...`);
    }

    console.log(
      "\n[Preview mode] No indices created. Run without --preview to build."
    );
    return;
  }

  const queryIndexPath = join(INDICES_DIR, QUERY_INDEX_NAME);

  if (forceRebuild && existsSync(queryIndexPath)) {
    console.log("Force rebuild: removing existing query-examples index...\n");
    rmSync(queryIndexPath, { recursive: true, force: true });
  }

  if (existsSync(queryIndexPath) && !forceRebuild) {
    console.log(`Index already exists at ${queryIndexPath}`);
    console.log("Use --force to rebuild\n");
    return;
  }

  console.log("Creating embeddings...");
  const embeddings = new OpenAIEmbeddings({ model: "text-embedding-3-small" });

  console.log(`Embedding ${documents.length} query example documents...`);
  const vectorStore = await FaissStore.fromDocuments(documents, embeddings);

  mkdirSync(INDICES_DIR, { recursive: true });
  await vectorStore.save(queryIndexPath);

  console.log(`\n✓ Query examples index saved to ${queryIndexPath}/\n`);
  console.log("=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total query examples: ${documents.length}`);
  console.log(`Index location: ${queryIndexPath}/`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
