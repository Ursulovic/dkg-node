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

export interface PineconeConfig {
  apiKey?: string;
  indexName?: string;
  openaiApiKey?: string;
  embeddingModel?: string;
  maxConcurrency?: number;
  chunkSize?: number;
  chunkOverlap?: number;
  dimensions?: number;
}

export type VectorDocument = Document<VectorStoreMetadata>;
