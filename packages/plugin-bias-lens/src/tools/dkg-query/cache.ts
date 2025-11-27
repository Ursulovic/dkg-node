import type { ClassInfo, SampleData, DiscoveryCache } from "./types.js";

let cache: DiscoveryCache | null = null;

export function getCache(): DiscoveryCache {
  if (!cache) {
    cache = {
      classes: [],
      predicatesByClass: new Map(),
      predicatesByKeyword: new Map(),
      samplesByClass: new Map(),
      lastUpdated: new Date(),
    };
  }
  return cache;
}

export function cacheClasses(classes: ClassInfo[]): void {
  const c = getCache();
  c.classes = classes;
  c.lastUpdated = new Date();
}

export function getCachedClasses(): ClassInfo[] | null {
  const c = getCache();
  if (c.classes.length === 0) {
    return null;
  }
  return c.classes;
}

export function cachePredicatesForClass(classUri: string, predicates: string[]): void {
  const c = getCache();
  c.predicatesByClass.set(classUri, predicates);
  c.lastUpdated = new Date();
}

export function getCachedPredicatesForClass(classUri: string): string[] | null {
  const c = getCache();
  return c.predicatesByClass.get(classUri) ?? null;
}

export function cachePredicatesByKeyword(keyword: string, predicates: string[]): void {
  const c = getCache();
  c.predicatesByKeyword.set(keyword.toLowerCase(), predicates);
  c.lastUpdated = new Date();
}

export function getCachedPredicatesByKeyword(keyword: string): string[] | null {
  const c = getCache();
  return c.predicatesByKeyword.get(keyword.toLowerCase()) ?? null;
}

export function cacheSamplesForClass(classUri: string, samples: SampleData[]): void {
  const c = getCache();
  c.samplesByClass.set(classUri, samples);
  c.lastUpdated = new Date();
}

export function getCachedSamplesForClass(classUri: string): SampleData[] | null {
  const c = getCache();
  return c.samplesByClass.get(classUri) ?? null;
}

export function clearCache(): void {
  cache = null;
}

export function getCacheStats(): { classes: number; predicatesByClass: number; predicatesByKeyword: number; samplesByClass: number; lastUpdated: Date | null } {
  if (!cache) {
    return {
      classes: 0,
      predicatesByClass: 0,
      predicatesByKeyword: 0,
      samplesByClass: 0,
      lastUpdated: null,
    };
  }
  return {
    classes: cache.classes.length,
    predicatesByClass: cache.predicatesByClass.size,
    predicatesByKeyword: cache.predicatesByKeyword.size,
    samplesByClass: cache.samplesByClass.size,
    lastUpdated: cache.lastUpdated,
  };
}
