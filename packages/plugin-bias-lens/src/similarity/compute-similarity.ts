import type { Document } from "@langchain/core/documents";
import type { SimilarityReport } from "./types";
import { computeTextSimilarity } from "./text-similarity";

/**
 * Compute comprehensive similarity between Grokipedia and Wikipedia documents
 *
 * @param grokDoc - Grokipedia document
 * @param wikiDoc - Wikipedia document
 * @returns Complete similarity analysis report
 */
export async function computeSimilarity(
  grokDoc: Document,
  wikiDoc: Document,
): Promise<SimilarityReport> {
  const grokContent = grokDoc.pageContent;
  const wikiContent = wikiDoc.pageContent;

  // Compute text similarity (primary metric, memory-efficient)
  const textSimilarity = await computeTextSimilarity(grokContent, wikiContent);

  // Overall alignment is now 100% text-based (media extraction removed to prevent OOM)
  const overallAlignment = textSimilarity.overallSimilarity;

  // Identify divergence areas
  const divergenceAreas = identifyDivergenceAreas(
    grokContent,
    wikiContent,
    textSimilarity,
  );

  // Empty media comparison (removed to prevent memory issues)
  const mediaComparison = {
    sharedImages: 0,
    uniqueToGrokipedia: [],
    uniqueToWikipedia: [],
    missingCriticalMedia: [],
    imageSimilarityScore: 0,
    sharedVideos: 0,
    uniqueVideosToGrokipedia: [],
    uniqueVideosToWikipedia: [],
    videoSimilarityScore: 0,
  };

  return {
    text: textSimilarity,
    media: mediaComparison,
    overallAlignment,
    divergenceAreas,
    analyzedAt: new Date().toISOString(),
  };
}

/**
 * Identify specific areas where content diverges significantly
 * Simplified to avoid memory-intensive section extraction
 */
function identifyDivergenceAreas(
  grokContent: string,
  wikiContent: string,
  textSimilarity: {
    overallSimilarity: number;
    semanticSimilarity: number;
    lengthRatio: number;
  },
): string[] {
  const areas: string[] = [];

  // Check overall similarity
  if (textSimilarity.overallSimilarity < 0.6) {
    areas.push("Significant overall content divergence detected");
  }

  // Check semantic divergence
  if (textSimilarity.semanticSimilarity < 0.5) {
    areas.push(
      "Low semantic similarity suggests different framing or perspective",
    );
  }

  // Check length differences
  if (textSimilarity.lengthRatio < 0.5) {
    areas.push("Grokipedia article is significantly shorter than Wikipedia");
  } else if (textSimilarity.lengthRatio > 1.5) {
    areas.push("Grokipedia article is significantly longer than Wikipedia");
  }

  // Count heading differences (simple, no extraction)
  const grokHeadings = (grokContent.match(/^#{1,6}\s+.+$/gm) || []).length;
  const wikiHeadings = (wikiContent.match(/^#{1,6}\s+.+$/gm) || []).length;

  if (grokHeadings < wikiHeadings * 0.5) {
    areas.push("Fewer sections in Grokipedia - potential omissions");
  }

  return areas;
}

/**
 * Generate a human-readable summary of similarity analysis
 */
export function summarizeSimilarity(report: SimilarityReport): string {
  const lines: string[] = [];

  // Overall alignment
  const alignmentPct = (report.overallAlignment * 100).toFixed(1);
  const alignmentLevel =
    report.overallAlignment > 0.8
      ? "High alignment"
      : report.overallAlignment > 0.6
        ? "Moderate alignment"
        : "Low alignment";

  lines.push(`## Content Similarity Analysis\n`);
  lines.push(`**Overall Alignment**: ${alignmentPct}% (${alignmentLevel})\n`);

  // Text similarity
  lines.push(`### Text Similarity\n`);
  lines.push(
    `- **Semantic similarity**: ${(report.text.semanticSimilarity * 100).toFixed(1)}% (meaning overlap)`,
  );
  lines.push(
    `- **Structural similarity**: ${(report.text.structuralSimilarity * 100).toFixed(1)}% (sections/headings)`,
  );
  lines.push(
    `- **Length ratio**: ${report.text.lengthRatio.toFixed(2)} (Grokipedia relative to Wikipedia)`,
  );
  lines.push(
    `- **N-gram overlap**: ${(report.text.ngramOverlap * 100).toFixed(1)}% (phrase similarity)\n`,
  );

  // Media comparison (skipped - removed to prevent memory issues)
  // Focus is on semantic text analysis which is more accurate for bias detection

  // Divergence areas
  if (report.divergenceAreas.length > 0) {
    lines.push(`### Key Divergence Areas\n`);
    report.divergenceAreas.forEach((area) => {
      lines.push(`- ${area}`);
    });
    lines.push("");
  }

  // Interpretation
  lines.push(`### Interpretation\n`);

  if (report.overallAlignment > 0.8) {
    lines.push(
      "The content shows **high alignment** between Grokipedia and Wikipedia. Differences are minimal and likely editorial.",
    );
  } else if (report.overallAlignment > 0.6) {
    lines.push(
      "The content shows **moderate alignment**. Some divergence detected - worth investigating specific sections for bias or inaccuracies.",
    );
  } else {
    lines.push(
      "The content shows **significant divergence**. Major differences suggest potential bias, missing context, or fundamental content gaps.",
    );
  }

  if (report.text.semanticSimilarity < 0.6) {
    lines.push(
      "\n⚠️ **Low semantic similarity** suggests different framing or perspective on the topic.",
    );
  }

  return lines.join("\n");
}
