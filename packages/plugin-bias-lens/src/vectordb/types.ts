import type { Document } from "@langchain/core/documents";

export interface VectorStoreMetadata {
  source: string;
  title?: string;
  documentType: "grokipedia" | "wikipedia";
  indexedAt: string;
}

export interface QueryOptions {
  filter?: {
    source?: string;
    title?: string;
    documentType?: "grokipedia" | "wikipedia";
  };
  k?: number;
}

export interface UpsertResult {
  cached: string[];
  indexed: string[];
}

/**
 * Callback functions for tracking PineconeRAG operations progress
 */
export interface PineconeRAGCallbacks {
  /**
   * Called when deduplication check starts
   * @param total - Total number of documents to check
   */
  onDeduplicationStart?: (total: number) => void | Promise<void>;

  /**
   * Called after each deduplication batch is processed
   * @param processed - Number of documents checked so far
   * @param total - Total number of documents to check
   * @param cached - Number of documents already indexed (so far)
   * @param toIndex - Number of documents to be indexed (so far)
   */
  onDeduplicationProgress?: (
    processed: number,
    total: number,
    cached: number,
    toIndex: number,
  ) => void | Promise<void>;

  /**
   * Called when deduplication check completes
   * @param cached - Total number of documents already indexed
   * @param toIndex - Total number of documents to be indexed
   */
  onDeduplicationComplete?: (cached: number, toIndex: number) => void | Promise<void>;

  /**
   * Called when document chunking starts
   * @param totalDocs - Total number of documents to chunk
   */
  onChunkingStart?: (totalDocs: number) => void | Promise<void>;

  /**
   * Called after each document batch is chunked
   * @param docsProcessed - Number of documents chunked so far
   * @param totalDocs - Total number of documents to chunk
   * @param chunksCreated - Number of chunks created from this batch
   * @param totalChunks - Total chunks created so far
   */
  onChunkingProgress?: (
    docsProcessed: number,
    totalDocs: number,
    chunksCreated: number,
    totalChunks: number,
  ) => void | Promise<void>;

  /**
   * Called when document chunking completes
   * @param totalDocs - Total documents chunked
   * @param totalChunks - Total chunks created
   */
  onChunkingComplete?: (totalDocs: number, totalChunks: number) => void | Promise<void>;

  /**
   * Called when chunk upload starts
   * @param totalChunks - Total number of chunks to upload
   */
  onUploadStart?: (totalChunks: number) => void | Promise<void>;

  /**
   * Called after each chunk batch is uploaded
   * @param chunksUploaded - Number of chunks uploaded so far
   * @param totalChunks - Total number of chunks to upload
   */
  onUploadProgress?: (chunksUploaded: number, totalChunks: number) => void | Promise<void>;

  /**
   * Called when chunk upload completes
   * @param totalChunks - Total chunks uploaded
   */
  onUploadComplete?: (totalChunks: number) => void | Promise<void>;

  /**
   * Called when the entire upsert operation completes
   * @param result - The UpsertResult with cached and indexed URLs
   */
  onUpsertComplete?: (result: UpsertResult) => void | Promise<void>;

  /**
   * Called if any error occurs during the upsert operation
   * @param error - The error that occurred
   * @param phase - Which phase the error occurred in
   */
  onError?: (
    error: Error,
    phase: "deduplication" | "chunking" | "upload",
  ) => void | Promise<void>;
}

export interface PineconeConfig {
  apiKey?: string;
  indexName?: string;
  openaiApiKey?: string;
  embeddingModel?: string;
  maxConcurrency?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  dimensions?: number;
  callbacks?: PineconeRAGCallbacks;
}

export type VectorDocument = Document<VectorStoreMetadata>;
