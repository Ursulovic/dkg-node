import { mkdir, readFile, writeFile, readdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { ReportStore, StoredReport, ReportMetadata } from "./types.js";
import type { BiasReportKnowledgeAsset } from "../agents/bias-detector/schema.js";

const STORAGE_DIR = "./storage";

function extractUuidFromIri(iri: string): string {
  const parts = iri.split("/");
  return parts[parts.length - 1] || iri;
}

function getFilePath(iri: string): string {
  const uuid = extractUuidFromIri(iri);
  return join(STORAGE_DIR, `${uuid}.report.json`);
}

interface SerializedReport {
  id: string;
  knowledgeAsset: BiasReportKnowledgeAsset;
  metadata: Omit<ReportMetadata, "createdAt" | "publishedAt"> & {
    createdAt: string;
    publishedAt: string | null;
  };
}

function serialize(report: StoredReport): string {
  const serialized: SerializedReport = {
    ...report,
    metadata: {
      ...report.metadata,
      createdAt: report.metadata.createdAt.toISOString(),
      publishedAt: report.metadata.publishedAt?.toISOString() || null,
    },
  };
  return JSON.stringify(serialized, null, 2);
}

function deserialize(json: string): StoredReport {
  const parsed: SerializedReport = JSON.parse(json);
  return {
    ...parsed,
    metadata: {
      ...parsed.metadata,
      createdAt: new Date(parsed.metadata.createdAt),
      publishedAt: parsed.metadata.publishedAt ? new Date(parsed.metadata.publishedAt) : null,
    },
  };
}

export async function createFileStore(): Promise<ReportStore> {
  await mkdir(STORAGE_DIR, { recursive: true });

  async function get(id: string): Promise<StoredReport | undefined> {
    try {
      const content = await readFile(getFilePath(id), "utf-8");
      return deserialize(content);
    } catch {
      return undefined;
    }
  }

  return {
    async save(knowledgeAsset, metadata) {
      const id = metadata.id;
      const report: StoredReport = {
        id,
        knowledgeAsset,
        metadata: { ...metadata, ual: null, explorerUrl: null, createdAt: new Date(), publishedAt: null },
      };
      await writeFile(getFilePath(id), serialize(report), "utf-8");
      return id;
    },

    get,

    async updateUal(id, ual, explorerUrl) {
      const report = await get(id);
      if (report) {
        report.metadata.ual = ual;
        report.metadata.explorerUrl = explorerUrl;
        report.metadata.publishedAt = new Date();
        await writeFile(getFilePath(id), serialize(report), "utf-8");
      }
    },

    async list() {
      try {
        const files = await readdir(STORAGE_DIR);
        const reports = await Promise.all(
          files
            .filter(f => f.endsWith(".report.json"))
            .map(async f => {
              const content = await readFile(join(STORAGE_DIR, f), "utf-8");
              const report = deserialize(content);
              return { id: report.id, metadata: report.metadata };
            })
        );
        return reports;
      } catch {
        return [];
      }
    },

    async delete(id) {
      try {
        await unlink(getFilePath(id));
        return true;
      } catch {
        return false;
      }
    },
  };
}
