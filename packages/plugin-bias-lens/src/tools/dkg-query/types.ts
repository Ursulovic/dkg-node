import type { SelectQuery } from "sparqljs";

export interface DkgQueryInput {
  query: string;
}

export interface DkgQueryResult {
  success: boolean;
  data: Record<string, unknown>[];
  sparqlUsed: string;
  error?: string;
  answer?: string;
}

export interface ClassInfo {
  type: string;
  count: number;
}

export interface PredicateInfo {
  predicate: string;
  count?: number;
}

export interface SampleData {
  predicate: string;
  object: string;
}

export interface DiscoveryCache {
  classes: ClassInfo[];
  predicatesByClass: Map<string, string[]>;
  predicatesByKeyword: Map<string, string[]>;
  samplesByClass: Map<string, SampleData[]>;
  lastUpdated: Date;
}

export interface DiscoveredSchema {
  classes: ClassInfo[];
  predicates: PredicateInfo[];
  samples: SampleData[];
}

export interface IterationAttempt {
  iteration: number;
  sparqlAttempted: string;
  error?: string;
  resultCount?: number;
  discoveries?: string[];
}

export interface DkgClient {
  graph: {
    query: (sparql: string, queryType: string) => Promise<{ data: Record<string, unknown>[] }>;
  };
}

export type { SelectQuery };
