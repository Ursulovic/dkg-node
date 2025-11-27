import { config } from "dotenv";
import { join } from "path";
import { getSchemaVectorStore } from "../src/tools/dkg-query/schema/index.js";

config({ path: join(process.cwd(), "../../apps/agent/.env") });

function parseArgs(args: string[]): {
  keywords: string[];
  namespaces?: string[];
  limit: number;
} {
  const keywords: string[] = [];
  let namespaces: string[] | undefined;
  let limit = 15;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--namespaces" || arg === "-n") {
      const next = args[++i];
      if (next) {
        namespaces = next.split(",").map((s) => s.trim());
      }
    } else if (arg === "--limit" || arg === "-l") {
      const next = args[++i];
      if (next) {
        limit = parseInt(next, 10);
      }
    } else if (!arg.startsWith("-")) {
      keywords.push(...arg.split(/\s+/));
    }
  }

  return { keywords, namespaces, limit };
}

function truncate(str: string | undefined, maxLen: number): string {
  if (!str) return "";
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
Usage: npx tsx scripts/search-schema.ts <keywords> [options]

Options:
  --namespaces, -n <ns1,ns2>  Filter by ontology namespaces (comma-separated)
  --limit, -l <number>        Max results to return (default: 15)
  --help, -h                  Show this help

Available namespaces:
  schema, rdf, rdfs, owl, dcterms, dcelems, foaf, skos, prov, as, shacl, xsd, ld

Examples:
  npx tsx scripts/search-schema.ts "review rating"
  npx tsx scripts/search-schema.ts person name --namespaces schema,foaf
  npx tsx scripts/search-schema.ts product --limit 5
`);
    process.exit(0);
  }

  const { keywords, namespaces, limit } = parseArgs(args);

  if (keywords.length === 0) {
    console.error("Error: At least one keyword is required");
    process.exit(1);
  }

  console.log(`\nSearching for: ${keywords.join(", ")}`);
  if (namespaces) {
    console.log(`Namespaces: ${namespaces.join(", ")}`);
  }
  console.log(`Limit: ${limit}\n`);

  const store = await getSchemaVectorStore();
  console.log(`Available namespaces: ${store.getAvailableNamespaces().join(", ")}\n`);

  const allResults = new Map<
    string,
    { pageContent: string; metadata: Record<string, unknown>; score: number }
  >();

  for (const keyword of keywords) {
    const results = await store.searchWithScore(keyword, limit, namespaces);
    for (const [doc, score] of results) {
      const existing = allResults.get(doc.metadata.uri as string);
      if (!existing || score < existing.score) {
        allResults.set(doc.metadata.uri as string, {
          pageContent: doc.pageContent,
          metadata: doc.metadata,
          score,
        });
      }
    }
  }

  const sorted = [...allResults.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);

  if (sorted.length === 0) {
    console.log("No results found.");
    process.exit(0);
  }

  console.log(`Found ${sorted.length} results:\n`);
  console.log("=".repeat(80));

  for (const result of sorted) {
    const meta = result.metadata;
    const type = meta.type as string;
    const label = meta.label as string;
    const uri = meta.uri as string;
    const description = meta.description as string | undefined;
    const score = result.score.toFixed(4);

    console.log(`\n[${type.toUpperCase()}] ${label}`);
    console.log(`URI: ${uri}`);
    console.log(`Score: ${score}`);
    if (description) {
      console.log(`Description: ${truncate(description, 200)}`);
    }

    if (type === "class") {
      const hierarchy = meta.hierarchy as string[];
      if (hierarchy && hierarchy.length > 0) {
        const labels = hierarchy.map((h: string) => h.split(/[/#]/).pop());
        console.log(`Hierarchy: ${label} → ${labels.join(" → ")}`);
      }
    }

    if (type === "property") {
      const domain = meta.domain as string[];
      const range = meta.range as string[];
      if (domain && domain.length > 0) {
        const labels = domain.map((d: string) => d.split(/[/#]/).pop());
        console.log(`Domain: ${labels.join(", ")}`);
      }
      if (range && range.length > 0) {
        const labels = range.map((r: string) => r.split(/[/#]/).pop());
        console.log(`Range: ${labels.join(", ")}`);
      }
    }

    console.log("-".repeat(80));
  }

  console.log(`\nShowing ${sorted.length} of ${allResults.size} unique results`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
