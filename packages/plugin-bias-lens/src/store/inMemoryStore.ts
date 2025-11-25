import type { BiasReportKnowledgeAsset } from "../agents/bias-detector/schema.js";
import type { ReportStore, StoredReport, ReportMetadata } from "./types.js";

export function createInMemoryStore(): ReportStore {
  const reports = new Map<string, StoredReport>();

  return {
    async save(knowledgeAsset, metadata) {
      const id = metadata.id;
      reports.set(id, {
        id,
        knowledgeAsset,
        metadata: { ...metadata, ual: null, explorerUrl: null, createdAt: new Date(), publishedAt: null }
      });
      return id;
    },

    async get(id) {
      return reports.get(id);
    },

    async updateUal(id, ual, explorerUrl) {
      const report = reports.get(id);
      if (report) {
        report.metadata.ual = ual;
        report.metadata.explorerUrl = explorerUrl;
        report.metadata.publishedAt = new Date();
      }
    },

    async list() {
      return Array.from(reports.values()).map(r => ({ id: r.id, metadata: r.metadata }));
    },

    async delete(id) {
      return reports.delete(id);
    }
  };
}
