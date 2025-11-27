import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { dirname, join } from "node:path";
import { readdirSync, existsSync } from "node:fs";
import type { DocumentMetadata } from "./types.js";

function findPackageRoot(): string {
  const possiblePaths = [
    join(process.cwd(), "src/tools/dkg-query/schema/indices"),
    join(process.cwd(), "packages/plugin-bias-lens/src/tools/dkg-query/schema/indices"),
    join(process.cwd(), "../plugin-bias-lens/src/tools/dkg-query/schema/indices"),
    join(process.cwd(), "../../packages/plugin-bias-lens/src/tools/dkg-query/schema/indices"),
  ];

  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }

  try {
    const packagePath = require.resolve("@dkg/plugin-bias-lens/package.json");
    return join(dirname(packagePath), "src/tools/dkg-query/schema/indices");
  } catch {
    return possiblePaths[0] ?? join(process.cwd(), "src/tools/dkg-query/schema/indices");
  }
}

function getIndicesPath(): string {
  return findPackageRoot();
}

export class DkgSchemaVectorStore {
  private indices: Map<string, FaissStore> = new Map();
  private embeddings: OpenAIEmbeddings;
  private indicesPath: string;

  constructor(indicesPath?: string) {
    this.embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
    });
    this.indicesPath = indicesPath || getIndicesPath();
  }

  async load(): Promise<void> {
    if (!existsSync(this.indicesPath)) {
      throw new Error(
        `Indices directory not found: ${this.indicesPath}. Run 'npm run build-ontologies' first.`
      );
    }

    const indexDirs = readdirSync(this.indicesPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    if (indexDirs.length === 0) {
      throw new Error(
        `No indices found in ${this.indicesPath}. Run 'npm run build-ontologies' first.`
      );
    }

    for (const dir of indexDirs) {
      const indexPath = join(this.indicesPath, dir);
      try {
        const store = await FaissStore.load(indexPath, this.embeddings);
        this.indices.set(dir, store);
      } catch (error) {
        console.warn(`Failed to load index ${dir}: ${error}`);
      }
    }

    if (this.indices.size === 0) {
      throw new Error("No valid indices could be loaded.");
    }
  }

  async search(
    query: string,
    k: number = 10,
    namespaces?: string[]
  ): Promise<Document<DocumentMetadata>[]> {
    if (this.indices.size === 0) {
      throw new Error("Vector store not loaded. Call load() first.");
    }

    const targetIndices = namespaces
      ? namespaces
          .map((ns) => this.indices.get(ns))
          .filter((store): store is FaissStore => store !== undefined)
      : Array.from(this.indices.values());

    if (targetIndices.length === 0) {
      return [];
    }

    const results = await Promise.all(
      targetIndices.map((store) => store.similaritySearchWithScore(query, k))
    );

    return results
      .flat()
      .sort((a, b) => a[1] - b[1])
      .slice(0, k)
      .map(([doc]) => doc as Document<DocumentMetadata>);
  }

  async searchWithScore(
    query: string,
    k: number = 10,
    namespaces?: string[]
  ): Promise<[Document<DocumentMetadata>, number][]> {
    if (this.indices.size === 0) {
      throw new Error("Vector store not loaded. Call load() first.");
    }

    const targetIndices = namespaces
      ? namespaces
          .map((ns) => this.indices.get(ns))
          .filter((store): store is FaissStore => store !== undefined)
      : Array.from(this.indices.values());

    if (targetIndices.length === 0) {
      return [];
    }

    const results = await Promise.all(
      targetIndices.map((store) => store.similaritySearchWithScore(query, k))
    );

    return results
      .flat()
      .sort((a, b) => a[1] - b[1])
      .slice(0, k) as [Document<DocumentMetadata>, number][];
  }

  getAvailableNamespaces(): string[] {
    return Array.from(this.indices.keys());
  }

  isLoaded(): boolean {
    return this.indices.size > 0;
  }
}
