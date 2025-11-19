import { promises as fs } from "node:fs";
import { join, dirname } from "node:path";
import type { CrossReferencedSection } from "./types";

/**
 * Cached summarizer output structure
 */
export interface CachedSummarizerOutput {
  grokipediaUrl: string;
  wikipediaUrl: string;
  sections: CrossReferencedSection[];
  similarityReport: any;
  cachedAt: string;
}

/**
 * Sanitize URL for safe filesystem usage
 * Converts URLs to filesystem-safe strings
 *
 * @param url - URL to sanitize
 * @returns Sanitized string safe for filenames
 */
export function sanitizeUrlForFilename(url: string): string {
  return (
    url
      // Remove protocol
      .replace(/^https?:\/\//, "")
      // Replace slashes with hyphens
      .replace(/\//g, "-")
      // Replace special characters with hyphens
      .replace(/[:?&=]/g, "-")
      // Replace multiple hyphens with single hyphen
      .replace(/-+/g, "-")
      // Remove trailing hyphens
      .replace(/-$/g, "")
      // Truncate to 200 chars to avoid filesystem limits
      .substring(0, 200)
  );
}

/**
 * Generate cache key from URL pair
 *
 * @param grokipediaUrl - Grokipedia article URL
 * @param wikipediaUrl - Wikipedia article URL
 * @returns Cache key (filename without extension)
 */
export function getCacheKey(
  grokipediaUrl: string,
  wikipediaUrl: string,
): string {
  const grokSanitized = sanitizeUrlForFilename(grokipediaUrl);
  const wikiSanitized = sanitizeUrlForFilename(wikipediaUrl);
  return `${grokSanitized}--${wikiSanitized}`;
}

/**
 * Get full cache file path
 *
 * @param grokipediaUrl - Grokipedia article URL
 * @param wikipediaUrl - Wikipedia article URL
 * @returns Absolute path to cache file
 */
export function getCachePath(
  grokipediaUrl: string,
  wikipediaUrl: string,
): string {
  const cacheKey = getCacheKey(grokipediaUrl, wikipediaUrl);
  // Storage directory is at plugin root
  const pluginRoot = join(__dirname, "..", "..");
  return join(pluginRoot, "storage", `${cacheKey}.json`);
}

/**
 * Check if cache exists for given URL pair
 *
 * @param grokipediaUrl - Grokipedia article URL
 * @param wikipediaUrl - Wikipedia article URL
 * @returns True if cache file exists
 */
export async function cacheExists(
  grokipediaUrl: string,
  wikipediaUrl: string,
): Promise<boolean> {
  try {
    const cachePath = getCachePath(grokipediaUrl, wikipediaUrl);
    await fs.access(cachePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read cache from disk
 *
 * @param grokipediaUrl - Grokipedia article URL
 * @param wikipediaUrl - Wikipedia article URL
 * @returns Cached data or null if not found/invalid
 */
export async function readCache(
  grokipediaUrl: string,
  wikipediaUrl: string,
): Promise<CachedSummarizerOutput | null> {
  try {
    const cachePath = getCachePath(grokipediaUrl, wikipediaUrl);
    const content = await fs.readFile(cachePath, "utf-8");
    const cached = JSON.parse(content) as CachedSummarizerOutput;

    // Validate cache structure
    if (
      !cached.grokipediaUrl ||
      !cached.wikipediaUrl ||
      !cached.sections ||
      !Array.isArray(cached.sections) ||
      !cached.similarityReport
    ) {
      console.warn("⚠️ Invalid cache structure, will re-scrape");
      // Delete corrupted cache
      await fs.unlink(cachePath).catch(() => {});
      return null;
    }

    return cached;
  } catch (error) {
    if ((error as any).code !== "ENOENT") {
      console.warn("⚠️ Error reading cache:", error);
    }
    return null;
  }
}

/**
 * Write cache to disk
 * Creates storage directory if it doesn't exist
 *
 * @param grokipediaUrl - Grokipedia article URL
 * @param wikipediaUrl - Wikipedia article URL
 * @param sections - Cross-referenced sections
 * @param similarityReport - Similarity computation result
 */
export async function writeCache(
  grokipediaUrl: string,
  wikipediaUrl: string,
  sections: CrossReferencedSection[],
  similarityReport: any,
): Promise<void> {
  try {
    const cachePath = getCachePath(grokipediaUrl, wikipediaUrl);

    // Ensure storage directory exists
    const storageDir = dirname(cachePath);
    await fs.mkdir(storageDir, { recursive: true });

    const cacheData: CachedSummarizerOutput = {
      grokipediaUrl,
      wikipediaUrl,
      sections,
      similarityReport,
      cachedAt: new Date().toISOString(),
    };

    await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), "utf-8");
  } catch (error) {
    console.error("❌ Error writing cache:", error);
    // Don't throw - caching is optional, continue without it
  }
}
