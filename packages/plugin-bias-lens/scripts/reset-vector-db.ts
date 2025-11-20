import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import * as readline from "node:readline/promises";
import "dotenv/config";

async function resetVectorDB() {
  // Verify environment variables
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX;

  if (!apiKey) {
    throw new Error(
      "PINECONE_API_KEY environment variable is required. Please set it in your .env file.",
    );
  }
  if (!indexName) {
    throw new Error(
      "PINECONE_INDEX environment variable is required. Please set it in your .env file.",
    );
  }

  console.log(`\nConnecting to Pinecone index: ${indexName}...`);

  const pinecone = new PineconeClient({ apiKey });
  const index = pinecone.Index(indexName);

  // Check current stats
  console.log("Fetching current index stats...");
  const statsBefore = await index.describeIndexStats();
  const totalVectors = statsBefore.totalRecordCount || 0;

  console.log(`Current vector count: ${totalVectors.toLocaleString()}\n`);

  if (totalVectors === 0) {
    console.log("✓ Index is already empty. Nothing to delete.");
    return;
  }

  // Safety confirmation prompt
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await rl.question(
    `⚠️  WARNING: This will permanently delete ALL ${totalVectors.toLocaleString()} vectors from index "${indexName}".\n` +
      `This operation is IRREVERSIBLE.\n\n` +
      `Type "yes" to confirm deletion: `,
  );
  rl.close();

  if (answer.toLowerCase() !== "yes") {
    console.log("\n✗ Aborted. No vectors were deleted.");
    return;
  }

  console.log("\nDeleting all vectors from the default namespace...");

  try {
    // Delete all vectors in the default namespace (empty string)
    await index.namespace("").deleteAll();

    console.log("✓ Delete operation completed successfully");

    // Verify deletion
    console.log("\nVerifying deletion...");
    const statsAfter = await index.describeIndexStats();
    const remainingVectors = statsAfter.totalRecordCount || 0;

    if (remainingVectors === 0) {
      console.log(
        `✓ Confirmed: All vectors deleted. Index is now empty.\n`,
      );
    } else {
      console.log(
        `⚠️  Warning: ${remainingVectors} vectors still remain in the index.`,
      );
      console.log(
        `This may be due to eventual consistency. Wait a few seconds and check again.\n`,
      );
    }
  } catch (error) {
    console.error("\n✗ Failed to delete vectors:", error);
    throw error;
  }
}

// Execute the reset
resetVectorDB()
  .then(() => {
    console.log("Reset complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nReset failed:", error);
    process.exit(1);
  });
