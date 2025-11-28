import { config } from "dotenv";
import { join } from "path";
import { getSchemaVectorStore } from "../src/tools/dkg-query/schema/index.js";

config({ path: join(process.cwd(), "../../apps/agent/.env") });

async function main() {
  console.log("\n=== Testing Query Examples Integration ===\n");

  console.log("Loading vector store...");
  const store = await getSchemaVectorStore();

  console.log("Testing query-examples namespace with priority ranking...\n");

  const testQueries = [
    { query: "list all bias reports", desc: "General listing query" },
    { query: "find reports about climate", desc: "Topic search query" },
    { query: "count reports by topic", desc: "Aggregation query" },
    { query: "paginate through reports", desc: "Pagination query" },
  ];

  for (const test of testQueries) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Query: "${test.query}" (${test.desc})`);
    console.log("=".repeat(60));

    const results = await store.searchWithPriority(test.query, 3, ["query-examples"]);

    if (results.length === 0) {
      console.log("❌ No results found");
      continue;
    }

    console.log(`Found ${results.length} results:\n`);

    for (const [idx, doc] of results.entries()) {
      if (doc.metadata.type === "query-example") {
        console.log(`${idx + 1}. ${doc.metadata.id}`);
        console.log(`   Priority: ${doc.metadata.priority}/10`);
        console.log(`   Category: ${doc.metadata.category}`);
        console.log(`   Keywords: ${doc.metadata.keywords.join(", ")}`);
      }
    }
  }

  console.log("\n\n=== Testing Mixed Search (All Namespaces) ===\n");

  const mixedQuery = "review rating properties";
  console.log(`Query: "${mixedQuery}"`);

  const mixedResults = await store.searchWithPriority(mixedQuery, 5);

  console.log(`\nFound ${mixedResults.length} results across all namespaces:\n`);

  for (const [idx, doc] of mixedResults.entries()) {
    console.log(`${idx + 1}. [${doc.metadata.type}] ${doc.metadata.type === "query-example" ? doc.metadata.id : (doc.metadata as any).label}`);
    if (doc.metadata.type === "query-example") {
      console.log(`   Priority: ${doc.metadata.priority}/10`);
    }
  }

  console.log("\n✅ Integration test complete\n");
}

main().catch((error) => {
  console.error("❌ Test failed:", error);
  process.exit(1);
});
