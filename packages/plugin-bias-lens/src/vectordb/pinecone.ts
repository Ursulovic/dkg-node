import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getCurrentRunTree, traceable } from "langsmith/traceable";
import "dotenv/config";

import type {
  PineconeConfig,
  QueryOptions,
  UpsertResult,
  VectorStoreMetadata,
} from "./types";

export class PineconeRAG {
  private vectorStore: PineconeStore;
  private embeddings: OpenAIEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor(config?: PineconeConfig) {
    const apiKey = config?.apiKey || process.env.PINECONE_API_KEY;
    const indexName = config?.indexName || process.env.PINECONE_INDEX;
    const openaiApiKey = config?.openaiApiKey || process.env.OPENAI_API_KEY;
    const embeddingModel = config?.embeddingModel || "text-embedding-3-large";
    const dimensions = config?.dimensions || 1024;
    const maxConcurrency = config?.maxConcurrency || 5;
    const chunkSize = config?.chunkSize || 1000;
    const chunkOverlap = config?.chunkOverlap || 200;

    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is required");
    }
    if (!indexName) {
      throw new Error("PINECONE_INDEX is required");
    }
    if (!openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required");
    }

    const pinecone = new PineconeClient({ apiKey });
    const pineconeIndex = pinecone.Index(indexName);

    this.embeddings = new OpenAIEmbeddings({
      apiKey: openaiApiKey,
      model: embeddingModel,
      dimensions,
    });

    this.vectorStore = new PineconeStore(this.embeddings, {
      pineconeIndex,
      maxConcurrency,
    });

    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
    });
  }

  upsert = traceable(
    async (documents: Document[]): Promise<UpsertResult> => {
      if (!documents || documents.length === 0) {
        throw new Error("Documents array cannot be empty");
      }

      const cached: string[] = [];
      const indexed: string[] = [];
      const toIndex: Document<VectorStoreMetadata>[] = [];

      for (const doc of documents) {
        if (!doc.metadata.source) {
          throw new Error("Document metadata must include a 'source' field");
        }
      }

      const checkResults = await Promise.all(
        documents.map(async (doc) => {
          const source = doc.metadata.source as string;
          const exists = await this.isIndexed(source);
          return { doc, source, exists };
        }),
      );

      for (const { doc, source, exists } of checkResults) {
        if (exists) {
          cached.push(source);
        } else {
          const enhancedDoc: Document<VectorStoreMetadata> = {
            ...doc,
            metadata: {
              source,
              title: doc.metadata.title as string | undefined,
              documentType: this.inferDocumentType(doc.metadata),
              indexedAt: new Date().toISOString(),
            },
          };
          toIndex.push(enhancedDoc);
          indexed.push(source);
        }
      }

      const runTree = getCurrentRunTree();
      if (runTree) {
        runTree.tags = [...(runTree.tags ?? []), "rag-upsert"];

        const sourceTags = documents
          .map((doc) => doc.metadata.source as string)
          .filter(Boolean);
        runTree.tags = [...runTree.tags, ...sourceTags];

        runTree.extra.metadata = {
          ...runTree.extra.metadata,
          documentCount: documents.length,
          cachedCount: cached.length,
          indexedCount: indexed.length,
          documentTypes: [
            ...new Set(toIndex.map((d) => d.metadata.documentType)),
          ],
        };
      }

      if (toIndex.length > 0) {
        const chunkedDocs = await this.textSplitter.splitDocuments(toIndex);
        await this.vectorStore.addDocuments(chunkedDocs);
      }

      return { cached, indexed };
    },
    { name: "rag-upsert" },
  );

  // TODO: Expand filter to support additional metadata fields from future document types
  // See GitHub issues assigned to Ursulovic for upcoming document type requirements
  retrieve = traceable(
    async (query: string, options?: QueryOptions): Promise<Document[]> => {
      const k = options?.k || 10;
      const filter = options?.filter || undefined;

      return this.vectorStore.similaritySearch(query, k, filter);
    },
    { name: "rag-retrieve" },
  );

  isIndexed = traceable(
    async (url: string): Promise<boolean> => {
      const results = await this.vectorStore.similaritySearch("", 1, {
        source: url,
      });
      return results.length > 0;
    },
    { name: "rag-is-indexed" },
  );

  // TODO: Expand this method to handle additional document types beyond grokipedia/wikipedia
  // See GitHub issues assigned to Ursulovic for future document type requirements
  private inferDocumentType(
    metadata: Record<string, unknown>,
  ): "grokipedia" | "wikipedia" {
    return metadata.title ? "grokipedia" : "wikipedia";
  }
}
