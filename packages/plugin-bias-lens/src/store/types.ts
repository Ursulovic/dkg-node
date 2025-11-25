import type { BiasReportKnowledgeAsset } from "../agents/bias-detector/schema.js";

export interface ReportMetadata {
  id: string;
  grokipediaUrl: string;
  wikipediaUrl: string;
  title: string;
  biasLevel: string;
  analysisDepth: string;
  costUsd: number;
  costTrac: number;
  privateAccessFee: number;
  ual: string | null;
  explorerUrl: string | null;
  createdAt: Date;
  publishedAt: Date | null;
}

export interface StoredReport {
  id: string;
  knowledgeAsset: BiasReportKnowledgeAsset;
  metadata: ReportMetadata;
}

export interface ReportStore {
  save(knowledgeAsset: BiasReportKnowledgeAsset, metadata: Omit<ReportMetadata, "ual" | "explorerUrl" | "createdAt" | "publishedAt">): Promise<string>;
  get(id: string): Promise<StoredReport | undefined>;
  updateUal(id: string, ual: string, explorerUrl: string): Promise<void>;
  list(): Promise<Array<{ id: string; metadata: ReportMetadata }>>;
  delete(id: string): Promise<boolean>;
}
