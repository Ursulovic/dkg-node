import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { join } from "node:path";
import type { ClassDocumentMetadata } from "./types.js";

function getIndexPath(): string {
  const cwd = process.cwd();
  if (cwd.includes("plugin-bias-lens")) {
    return join(cwd, "src/tools/dkg-query/schema/dkg-schema-index");
  }
  return join(cwd, "packages/plugin-bias-lens/src/tools/dkg-query/schema/dkg-schema-index");
}

export class DkgSchemaVectorStore {
  private store: FaissStore | null = null;
  private embeddings: OpenAIEmbeddings;
  private indexPath: string;

  constructor(indexPath?: string) {
    this.embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
    });
    this.indexPath = indexPath || getIndexPath();
  }

  async load(): Promise<void> {
    this.store = await FaissStore.load(this.indexPath, this.embeddings);
  }

  async search(
    query: string,
    k: number = 10
  ): Promise<Document<ClassDocumentMetadata>[]> {
    if (!this.store) {
      throw new Error("Vector store not loaded. Call load() first.");
    }
    return this.store.similaritySearch(query, k) as Promise<
      Document<ClassDocumentMetadata>[]
    >;
  }

  async searchWithScore(
    query: string,
    k: number = 10
  ): Promise<[Document<ClassDocumentMetadata>, number][]> {
    if (!this.store) {
      throw new Error("Vector store not loaded. Call load() first.");
    }
    return this.store.similaritySearchWithScore(query, k) as Promise<
      [Document<ClassDocumentMetadata>, number][]
    >;
  }

  async addDocument(doc: Document<ClassDocumentMetadata>): Promise<void> {
    if (!this.store) {
      throw new Error("Vector store not loaded. Call load() first.");
    }
    await this.store.addDocuments([doc]);
    await this.store.save(this.indexPath);
  }

  isLoaded(): boolean {
    return this.store !== null;
  }
}
