import { OpenAIEmbeddings } from "@langchain/openai";

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

export async function calculateArticleSimilarity(
  grokipediaContent: string,
  wikipediaContent: string
): Promise<SimilarityResult> {
  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
  });

  const [grokipediaEmbedding, wikipediaEmbedding] = await Promise.all([
    embeddings.embedQuery(grokipediaContent),
    embeddings.embedQuery(wikipediaContent),
  ]);

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
