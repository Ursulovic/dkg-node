export type { ReportStore, StoredReport, ReportMetadata } from "./types.js";
export { createFileStore } from "./fileStore.js";

import { createFileStore } from "./fileStore.js";
import type { ReportStore } from "./types.js";

let store: ReportStore | null = null;

async function getStore(): Promise<ReportStore> {
  if (!store) {
    store = await createFileStore();
  }
  return store;
}

export const reportStore: ReportStore = {
  async save(knowledgeAsset, metadata) {
    const s = await getStore();
    return s.save(knowledgeAsset, metadata);
  },
  async get(id) {
    const s = await getStore();
    return s.get(id);
  },
  async updateUal(id, ual, explorerUrl) {
    const s = await getStore();
    return s.updateUal(id, ual, explorerUrl);
  },
  async list() {
    const s = await getStore();
    return s.list();
  },
  async delete(id) {
    const s = await getStore();
    return s.delete(id);
  },
};
