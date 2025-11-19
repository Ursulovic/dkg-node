import "dotenv/config";

import { OpenAIEmbeddings } from "@langchain/openai";
import type { TextSimilarityScore, DocumentStructure } from "./types";

/**
 * Compute comprehensive text similarity between two documents
 *
 * Uses semantic similarity (embeddings) as the primary metric, which is
 * memory-efficient and highly accurate for comparing document meaning.
 *
 * @param grokContent - Grokipedia article content (markdown)
 * @param wikiContent - Wikipedia article content (markdown)
 * @returns Text similarity scores
 */
export async function computeTextSimilarity(
  grokContent: string,
  wikiContent: string,
): Promise<TextSimilarityScore> {
  // Use semantic similarity (embeddings) as the primary metric
  // This is memory-efficient (samples text) and most accurate
  const semanticSimilarity = await computeSemanticSimilarity(
    grokContent,
    wikiContent,
  );

  // Simple length ratio for context (no memory overhead)
  const lengthRatio = computeLengthRatio(grokContent, wikiContent);

  // Simple heading count comparison (no extraction, just regex count)
  const structuralSimilarity = computeSimpleStructuralSimilarity(
    grokContent,
    wikiContent,
  );

  // Overall similarity is primarily semantic (embeddings)
  const overallSimilarity =
    semanticSimilarity * 0.7 +
    structuralSimilarity * 0.2 +
    Math.min(lengthRatio, 1.0) * 0.1; // Cap at 1.0 (Grok shouldn't be longer)

  return {
    semanticSimilarity,
    structuralSimilarity,
    lengthRatio,
    ngramOverlap: 0, // Removed to prevent memory issues
    overallSimilarity,
  };
}

/**
 * Compute semantic similarity using OpenAI embeddings
 */
async function computeSemanticSimilarity(
  text1: string,
  text2: string,
): Promise<number> {
  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small", // Faster and cheaper than large
  });

  // For very long documents, take a representative sample
  // (embeddings have token limits)
  const sample1 = sampleText(text1, 6000); // ~8000 tokens max
  const sample2 = sampleText(text2, 6000);

  // Generate embeddings
  const [embedding1, embedding2] = await Promise.all([
    embeddings.embedQuery(sample1),
    embeddings.embedQuery(sample2),
  ]);

  // Compute cosine similarity
  return cosineSimilarity(embedding1, embedding2);
}

/**
 * Compute simple structural similarity (heading and citation counts only)
 * Memory-efficient: uses regex matching without extraction/storage
 */
function computeSimpleStructuralSimilarity(
  text1: string,
  text2: string,
): number {
  // Count headings (no extraction)
  const headingCount1 = (text1.match(/^#{1,6}\s+.+$/gm) || []).length;
  const headingCount2 = (text2.match(/^#{1,6}\s+.+$/gm) || []).length;

  // Count citations (no extraction)
  const citationCount1 =
    (text1.match(/\[\[\d+\]\]/g) || []).length +
    (text1.match(/\[\d+\]/g) || []).length;
  const citationCount2 =
    (text2.match(/\[\[\d+\]\]/g) || []).length +
    (text2.match(/\[\d+\]/g) || []).length;

  // Normalized difference (1.0 = identical, 0.0 = completely different)
  const headingSimilarity =
    1 -
    Math.abs(headingCount1 - headingCount2) /
      Math.max(headingCount1, headingCount2, 1);

  const citationSimilarity =
    1 -
    Math.abs(citationCount1 - citationCount2) /
      Math.max(citationCount1, citationCount2, 1);

  // Average
  return (headingSimilarity + citationSimilarity) / 2;
}

/**
 * Compute length ratio (word count comparison)
 */
function computeLengthRatio(grokContent: string, wikiContent: string): number {
  const grokWords = countWords(grokContent);
  const wikiWords = countWords(wikiContent);

  if (wikiWords === 0) return 0;

  return grokWords / wikiWords;
}


/**
 * Count words in text
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}


/**
 * Compute cosine similarity between two vectors
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error("Vectors must have same length");
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i]! * vec2[i]!;
    norm1 += vec1[i]! * vec1[i]!;
    norm2 += vec2[i]! * vec2[i]!;
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Sample text intelligently (take intro, middle, and conclusion)
 */
function sampleText(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  // Take beginning, middle, and end samples
  const chunkSize = Math.floor(maxChars / 3);
  const beginning = text.substring(0, chunkSize);
  const middleStart = Math.floor((text.length - chunkSize) / 2);
  const middle = text.substring(middleStart, middleStart + chunkSize);
  const end = text.substring(text.length - chunkSize);

  return `${beginning}\n...\n${middle}\n...\n${end}`;
}
