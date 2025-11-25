import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { type CostTracker } from "./costTracker.js";

const CHUNK_SIZE = 6000;
const EMBEDDING_MODEL = "text-embedding-3-large";
const CHARS_PER_TOKEN_ESTIMATE = 4;

interface SimilarityResult {
  cosineSimilarity: number;
  grokipediaLength: number;
  wikipediaLength: number;
  lengthRatio: number;
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

function magnitude(vec: number[]): number {
  let sum = 0;
  for (const val of vec) {
    sum += val * val;
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = dotProduct(a, b);
  const magA = magnitude(a);
  const magB = magnitude(b);

  if (magA === 0 || magB === 0) {
    return 0;
  }

  return dot / (magA * magB);
}

function averageEmbeddings(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return [];
  if (embeddings.length === 1) return embeddings[0] ?? [];

  const firstEmbedding = embeddings[0];
  if (!firstEmbedding) return [];

  const dim = firstEmbedding.length;
  const avg = new Array<number>(dim).fill(0);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      const current = avg[i] ?? 0;
      avg[i] = current + (emb[i] ?? 0) / embeddings.length;
    }
  }
  return avg;
}

export async function calculateArticleSimilarity(
  grokipediaContent: string,
  wikipediaContent: string,
  costTracker?: CostTracker
): Promise<SimilarityResult> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: 0,
  });

  const embeddings = new OpenAIEmbeddings({
    model: EMBEDDING_MODEL,
  });

  const [grokChunks, wikiChunks] = await Promise.all([
    splitter.splitText(grokipediaContent),
    splitter.splitText(wikipediaContent),
  ]);

  const [grokEmbeddings, wikiEmbeddings] = await Promise.all([
    embeddings.embedDocuments(grokChunks),
    embeddings.embedDocuments(wikiChunks),
  ]);

  if (costTracker) {
    const totalChars =
      grokChunks.reduce((sum, chunk) => sum + chunk.length, 0) +
      wikiChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const estimatedTokens = Math.ceil(totalChars / CHARS_PER_TOKEN_ESTIMATE);
    costTracker.trackTokens(EMBEDDING_MODEL, {
      inputTokens: estimatedTokens,
      outputTokens: 0,
    });
  }

  const grokipediaEmbedding = averageEmbeddings(grokEmbeddings);
  const wikipediaEmbedding = averageEmbeddings(wikiEmbeddings);

  const similarity = cosineSimilarity(grokipediaEmbedding, wikipediaEmbedding);

  const grokipediaLength = grokipediaContent.length;
  const wikipediaLength = wikipediaContent.length;
  const lengthRatio =
    wikipediaLength > 0 ? grokipediaLength / wikipediaLength : 0;

  return {
    cosineSimilarity: similarity,
    grokipediaLength,
    wikipediaLength,
    lengthRatio,
  };
}

export { cosineSimilarity };
export type { SimilarityResult };
