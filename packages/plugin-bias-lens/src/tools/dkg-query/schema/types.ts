export interface ClassInfo {
  uri: string;
  count: number;
}

export interface PredicateInfo {
  uri: string;
  label: string;
  usageCount: number;
}

export interface ClassDocumentMetadata {
  uri: string;
  label: string;
  description?: string;
  namespace: string;
  instanceCount: number;
  predicates: PredicateInfo[];
  fetchedAt: string;
}

export interface Checkpoint {
  startedAt: string;
  lastUpdatedAt: string;
  totalClasses: number;
  processedCount: number;
  processedUris: string[];
  status: "in_progress" | "completed" | "failed";
  lastError?: string;
}

export interface SerializedDocument {
  pageContent: string;
  metadata: ClassDocumentMetadata;
}
