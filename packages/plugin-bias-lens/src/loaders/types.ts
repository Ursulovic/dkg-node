import type { Document } from "@langchain/core/documents";

// Metadata interfaces
export interface PdfMetadata {
  source: string; // Article URL where PDF was found
  assetSource: string; // Actual PDF URL
  assetType: "pdf";
}

export interface HtmlMetadata {
  source: string; // Article URL where link was found
  assetSource: string; // Actual page URL
  assetType: "html";
}

export interface MediaMetadata {
  source: string; // Article URL where media was found
  assetSource: string; // Actual media URL
  assetType: "image" | "video" | "audio";
}

// Document types with UUID
export type PdfDocument = Document<PdfMetadata> & { id: string };
export type HtmlDocument = Document<HtmlMetadata> & { id: string };
export type MediaDocument = Document<MediaMetadata> & { id: string };
export type ExternalAssetDocument = PdfDocument | HtmlDocument | MediaDocument;

// Error and result types
export interface LoadError {
  url: string;
  type: string;
  error: string;
}

export interface LoadStats {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
}

export interface LoadResult<T> {
  documents: T[];
  errors: LoadError[];
  stats: LoadStats;
}

// Callback interfaces
export interface ExternalAssetsLoaderCallbacks {
  onPhaseStart?: (
    phase: "pdf" | "html" | "media",
    total: number,
    duplicates: number,
  ) => void | Promise<void>;
  onAssetLoaded?: (
    phase: "pdf" | "html" | "media",
    url: string,
    index: number,
    total: number,
  ) => void | Promise<void>;
  onAssetError?: (
    phase: "pdf" | "html" | "media",
    url: string,
    error: string,
    index: number,
    total: number,
  ) => void | Promise<void>;
  onBatchComplete?: (
    phase: "pdf" | "html",
    batchNumber: number,
    totalBatches: number,
    succeeded: number,
    failed: number,
  ) => void | Promise<void>;
  onPhaseComplete?: (
    phase: "pdf" | "html" | "media",
    stats: LoadStats,
  ) => void | Promise<void>;
  onLoadComplete?: (stats: LoadStats) => void | Promise<void>;
}

// Options interface
export interface ExternalAssetsLoaderOptions {
  timeout?: number;
  concurrency?: number;
  callbacks?: ExternalAssetsLoaderCallbacks;
}
