import { config } from "dotenv";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { validateSparql, wrapSparqlStringWithDkgPattern } from "../src/tools/dkg-query/sparql/generator.js";
import type { DkgClient } from "../src/tools/dkg-query/types.js";
import DKG from "dkg.js";

config({ path: join(process.cwd(), "../../apps/agent/.env") });

interface Args {
  query?: string;
  file?: string;
  format: "json" | "table" | "raw";
  limit?: number;
}

function showHelp(): void {
  console.log(`
Usage: npm run sparql -- [options]

Options:
  --query, -q <sparql>     SPARQL query string to execute
  --file, -f <path>        Path to .sparql file containing query
  --format <type>          Output format: json, table, raw (default: table)
  --limit, -l <number>     Add LIMIT clause if not present
  --help, -h               Show this help message

Examples:
  # Execute inline query
  npm run sparql -- --query "SELECT ?s WHERE { ?s a <http://schema.org/ClaimReview> } LIMIT 5"

  # Execute from file
  npm run sparql -- --file queries/count-reports.sparql

  # With JSON output
  npm run sparql -- --file queries/find-bias.sparql --format json

  # With automatic limit
  npm run sparql -- --query "SELECT ?s ?p ?o WHERE { ?s ?p ?o }" --limit 10

Bias Report Query Examples:
  # Count all bias reports
  SELECT (COUNT(DISTINCT ?report) AS ?count) WHERE {
    ?report a <http://schema.org/ClaimReview> .
  }

  # Find high/severe bias reports
  SELECT ?report ?rating WHERE {
    ?report a <http://schema.org/ClaimReview> .
    ?report <http://schema.org/reviewRating> ?ratingObj .
    ?ratingObj <http://schema.org/ratingValue> ?rating .
    FILTER(?rating <= 2)
  }
`);
}

function parseArgs(argv: string[]): Args | null {
  const args: Args = {
    format: "table",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    switch (arg) {
      case "--help":
      case "-h":
        showHelp();
        return null;

      case "--query":
      case "-q":
        args.query = argv[++i];
        break;

      case "--file":
      case "-f":
        args.file = argv[++i];
        break;

      case "--format":
        const format = argv[++i];
        if (format !== "json" && format !== "table" && format !== "raw") {
          console.error(`Invalid format: ${format}. Use json, table, or raw.`);
          process.exit(1);
        }
        args.format = format;
        break;

      case "--limit":
      case "-l":
        const limit = parseInt(argv[++i], 10);
        if (isNaN(limit) || limit <= 0) {
          console.error(`Invalid limit: ${argv[i]}. Must be a positive number.`);
          process.exit(1);
        }
        args.limit = limit;
        break;

      default:
        console.error(`Unknown option: ${arg}`);
        showHelp();
        process.exit(1);
    }
  }

  return args;
}

function readQueryFromFile(filePath: string): string {
  if (!existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  try {
    return readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`Error reading file: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

async function createDkgClient(): Promise<DkgClient> {
  const otnodeUrl = new URL(process.env.DKG_OTNODE_URL || "https://v6-pegasus-node-02.origin-trail.network");

  return new DKG({
    endpoint: `${otnodeUrl.protocol}//${otnodeUrl.hostname}`,
    port: otnodeUrl.port || "8900",
    blockchain: {
      name: process.env.DKG_BLOCKCHAIN || "otp:20430",
      privateKey: process.env.DKG_PUBLISH_WALLET,
    },
    maxNumberOfRetries: 300,
    frequency: 2,
    contentType: "all",
    nodeApiVersion: "/v1",
  });
}

function formatOutput(data: Record<string, unknown>[], format: string): void {
  if (data.length === 0) {
    console.log("No results returned.");
    return;
  }

  switch (format) {
    case "json":
      console.log(JSON.stringify(data, null, 2));
      break;

    case "table":
      console.table(data);
      break;

    case "raw":
      for (const row of data) {
        console.log(row);
      }
      break;
  }
}

async function main() {
  try {
    const args = parseArgs(process.argv.slice(2));

    if (!args) {
      process.exit(0);
    }

    let sparql = args.query;
    if (args.file) {
      sparql = readQueryFromFile(args.file);
    }

    if (!sparql) {
      console.error("Error: No query provided. Use --query or --file.");
      showHelp();
      process.exit(1);
    }

    console.log("Validating SPARQL query...");
    const validation = validateSparql(sparql);
    if (!validation.valid) {
      console.error(`\nInvalid SPARQL syntax:\n${validation.error}`);
      process.exit(1);
    }

    if (args.limit && !sparql.toUpperCase().includes("LIMIT")) {
      sparql = `${sparql.trim()} LIMIT ${args.limit}`;
      console.log(`Added LIMIT ${args.limit} to query.`);
    }

    console.log("Wrapping query with DKG graph patterns...");
    const wrapped = wrapSparqlStringWithDkgPattern(sparql);
    if (!wrapped.success) {
      console.error(`\nFailed to wrap query:\n${wrapped.error}`);
      process.exit(1);
    }

    console.log("Creating DKG client...");
    const dkgClient = await createDkgClient();

    console.log("Executing query against DKG...\n");
    console.log("Query:");
    console.log("-".repeat(80));
    console.log(sparql);
    console.log("-".repeat(80));
    console.log();

    const result = await dkgClient.graph.query(wrapped.sparql!, "SELECT");

    console.log(`\nResults: ${result.data?.length ?? 0} rows\n`);

    if (result.data && result.data.length > 0) {
      formatOutput(result.data, args.format);
    } else {
      console.log("No results returned.");
    }

    console.log();
    process.exit(0);

  } catch (error) {
    console.error("\nError:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:");
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
