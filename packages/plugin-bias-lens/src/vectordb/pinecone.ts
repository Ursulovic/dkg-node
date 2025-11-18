import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { getCurrentRunTree, traceable } from "langsmith/traceable";
import "dotenv/config";

import type {
  PineconeConfig,
  PineconeRAGCallbacks,
  QueryOptions,
  UpsertResult,
  VectorStoreMetadata,
} from "./types";

export class PineconeRAG {
  private vectorStore: PineconeStore;
  private embeddings: OpenAIEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;
  private callbacks?: PineconeRAGCallbacks;

  constructor(config?: PineconeConfig) {
    const apiKey = config?.apiKey || process.env.PINECONE_API_KEY;
    const indexName = config?.indexName || process.env.PINECONE_INDEX;
    const openaiApiKey = config?.openaiApiKey || process.env.OPENAI_API_KEY;
    const embeddingModel = config?.embeddingModel || "text-embedding-3-large";
    const dimensions = config?.dimensions || 1024;
    const maxConcurrency = config?.maxConcurrency || 5;
    const chunkSize = config?.chunkSize || 600;
    const chunkOverlap = config?.chunkOverlap || 100;

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

    this.callbacks = config?.callbacks;
  }

  /**
   * Safely invoke a callback if it exists
   * Catches and logs callback errors to prevent them from breaking main operations
   */
  private async invokeCallback<T extends (...args: any[]) => void | Promise<void>>(
    callback: T | undefined,
    ...args: Parameters<T>
  ): Promise<void> {
    if (!callback) return;

    try {
      await callback(...args);
    } catch (error) {
      console.error("Callback error:", error);
    }
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

      // Batch deduplication checks to avoid excessive concurrent Pinecone API calls
      const DEDUP_BATCH_SIZE = 50;
      const checkResults: Array<{
        doc: Document;
        source: string;
        exists: boolean;
      }> = [];

      await this.invokeCallback(this.callbacks?.onDeduplicationStart, documents.length);

      for (let i = 0; i < documents.length; i += DEDUP_BATCH_SIZE) {
        const batch = documents.slice(i, i + DEDUP_BATCH_SIZE);
        const batchResults = await Promise.all(
          batch.map(async (doc) => {
            const source = doc.metadata.source as string;
            const exists = await this.isIndexed(source);
            return { doc, source, exists };
          }),
        );
        checkResults.push(...batchResults);

        // Track progress after each batch (temporary counts)
        const tempCached = checkResults.filter((r) => r.exists).length;
        const tempToIndex = checkResults.filter((r) => !r.exists).length;
        await this.invokeCallback(
          this.callbacks?.onDeduplicationProgress,
          checkResults.length,
          documents.length,
          tempCached,
          tempToIndex,
        );
      }

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

      await this.invokeCallback(
        this.callbacks?.onDeduplicationComplete,
        cached.length,
        toIndex.length,
      );

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
        await this.invokeCallback(this.callbacks?.onChunkingStart, toIndex.length);

        // Batch documents before chunking to avoid memory issues
        const DOC_BATCH_SIZE = 50; // Process 50 documents at a time
        let totalChunksCreated = 0;
        let totalChunksUploaded = 0;

        for (let i = 0; i < toIndex.length; i += DOC_BATCH_SIZE) {
          const docBatch = toIndex.slice(i, i + DOC_BATCH_SIZE);
          const chunkedDocs = await this.textSplitter.splitDocuments(docBatch);

          // Progress logging for large operations
          if (toIndex.length > DOC_BATCH_SIZE) {
            const batchNum = Math.floor(i / DOC_BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(toIndex.length / DOC_BATCH_SIZE);
            console.log(
              `Processing document batch ${batchNum}/${totalBatches} (${docBatch.length} docs → ${chunkedDocs.length} chunks)`,
            );
          }

          totalChunksCreated += chunkedDocs.length;

          await this.invokeCallback(
            this.callbacks?.onChunkingProgress,
            Math.min(i + DOC_BATCH_SIZE, toIndex.length),
            toIndex.length,
            chunkedDocs.length,
            totalChunksCreated,
          );

          // Upload start callback on first batch
          if (i === 0) {
            await this.invokeCallback(this.callbacks?.onUploadStart, totalChunksCreated);
          }

          // Upload chunks in sub-batches to handle cases where 50 docs create many chunks
          const CHUNK_BATCH_SIZE = 100;
          for (let j = 0; j < chunkedDocs.length; j += CHUNK_BATCH_SIZE) {
            const chunkBatch = chunkedDocs.slice(j, j + CHUNK_BATCH_SIZE);
            await this.vectorStore.addDocuments(chunkBatch);

            totalChunksUploaded += chunkBatch.length;

            await this.invokeCallback(
              this.callbacks?.onUploadProgress,
              totalChunksUploaded,
              totalChunksCreated,
            );
          }
        }

        await this.invokeCallback(
          this.callbacks?.onChunkingComplete,
          toIndex.length,
          totalChunksCreated,
        );

        await this.invokeCallback(this.callbacks?.onUploadComplete, totalChunksUploaded);
      }

      const result = { cached, indexed };

      await this.invokeCallback(this.callbacks?.onUpsertComplete, result);

      return result;
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
