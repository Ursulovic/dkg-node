import { Document } from "@langchain/core/documents";
import { DkgSchemaVectorStore } from "./store.js";
import type { ClassDocumentMetadata, PredicateInfo } from "./types.js";

let vectorStore: DkgSchemaVectorStore | null = null;

export async function getSchemaVectorStore(): Promise<DkgSchemaVectorStore> {
  if (!vectorStore) {
    vectorStore = new DkgSchemaVectorStore();
    await vectorStore.load();
  }
  return vectorStore;
}

export function buildClassDocument(
  uri: string,
  label: string,
  namespace: string,
  instanceCount: number,
  predicates: PredicateInfo[],
  description?: string
): Document<ClassDocumentMetadata> {
  const predicateLabels = predicates.map((p) => p.label).join(", ");

  const pageContent = `${label} (${namespace})
${description || "No description available."}
Predicates: ${predicateLabels || "none discovered"}
Instance count: ${instanceCount}`;

  return new Document<ClassDocumentMetadata>({
    pageContent,
    metadata: {
      uri,
      label,
      description,
      namespace,
      instanceCount,
      predicates,
      fetchedAt: new Date().toISOString(),
    },
  });
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
export type { ClassDocumentMetadata, PredicateInfo } from "./types.js";
