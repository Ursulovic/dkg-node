import { Document } from "@langchain/core/documents";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { QueryExampleMetadata } from "./types.js";

function parseMarkdownMetadata(content: string, filePath: string): QueryExampleMetadata {
  const lines = content.split("\n");

  let id = "";
  let category = "";
  let priority = 7;
  let keywords: string[] = [];

  for (const line of lines) {
    const idMatch = line.match(/^\*\*ID\*\*:\s*(.+)$/);
    if (idMatch) {
      id = idMatch[1]?.trim() ?? "";
      continue;
    }

    const categoryMatch = line.match(/^\*\*Category\*\*:\s*(.+)$/);
    if (categoryMatch) {
      category = categoryMatch[1]?.trim() ?? "";
      continue;
    }

    const priorityMatch = line.match(/^\*\*Priority\*\*:\s*(\d+)$/);
    if (priorityMatch) {
      priority = parseInt(priorityMatch[1] ?? "7", 10);
      continue;
    }

    const keywordsMatch = line.match(/^\*\*Keywords\*\*:\s*(.+)$/);
    if (keywordsMatch) {
      keywords = (keywordsMatch[1] ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      continue;
    }
  }

  if (!id) {
    throw new Error(`Missing ID in query example file: ${filePath}`);
  }

  return {
    id,
    category,
    priority,
    keywords,
    type: "query-example",
    filePath,
  };
}

export function loadQueryExamples(examplesDir: string): Document<QueryExampleMetadata>[] {
  const files = readdirSync(examplesDir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(examplesDir, f));

  const documents: Document<QueryExampleMetadata>[] = [];

  for (const filePath of files) {
    const content = readFileSync(filePath, "utf-8");
    const metadata = parseMarkdownMetadata(content, filePath);

    documents.push(
      new Document({
        pageContent: content,
        metadata,
      })
    );
  }

  return documents;
}
