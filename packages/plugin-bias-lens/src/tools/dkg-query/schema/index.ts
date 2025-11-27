import { DkgSchemaVectorStore } from "./store.js";

let vectorStore: DkgSchemaVectorStore | null = null;
let loadingPromise: Promise<DkgSchemaVectorStore> | null = null;

export async function getSchemaVectorStore(): Promise<DkgSchemaVectorStore> {
  if (vectorStore) {
    return vectorStore;
  }

  if (!loadingPromise) {
    loadingPromise = (async () => {
      const store = new DkgSchemaVectorStore();
      await store.load();
      vectorStore = store;
      return store;
    })();
  }

  return loadingPromise;
}

export function extractLabel(uri: string): string {
  return uri.split(/[/#]/).pop() || uri;
}

export function extractNamespace(uri: string): string {
  const lastSlash = uri.lastIndexOf("/");
  const lastHash = uri.lastIndexOf("#");
  const splitIndex = Math.max(lastSlash, lastHash);
  return splitIndex > 0 ? uri.substring(0, splitIndex + 1) : uri;
}

export { DkgSchemaVectorStore } from "./store.js";
export type {
  OntologyClass,
  OntologyProperty,
  ClassDocumentMetadata,
  PropertyDocumentMetadata,
  DocumentMetadata,
} from "./types.js";
