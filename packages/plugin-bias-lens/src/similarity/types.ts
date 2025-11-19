/**
 * Type definitions for content similarity analysis
 */

/**
 * Represents a media asset (image or video) extracted from article content
 */
export interface MediaAsset {
  /** Type of media */
  type: "image" | "video";
  /** Full URL to the media resource */
  url: string;
  /** Alt text or title */
  alt?: string;
  /** Caption text if available */
  caption?: string;
  /** Surrounding text context (paragraph containing the media) */
  context?: string;
  /** Position in the article (0-based index) */
  position?: number;
}

/**
 * Text similarity metrics comparing two documents
 */
export interface TextSimilarityScore {
  /** Semantic similarity using embeddings (0-1, cosine similarity) */
  semanticSimilarity: number;
  /** Structural similarity: section count, heading overlap, citation count (0-1) */
  structuralSimilarity: number;
  /** Word count ratio: grok_words / wiki_words */
  lengthRatio: number;
  /** N-gram overlap score, BLEU-style (0-1) */
  ngramOverlap: number;
  /** Weighted average of all metrics (0-1) */
  overallSimilarity: number;
}

/**
 * Results of comparing media assets between two sources
 */
export interface MediaComparisonResult {
  /** Number of images shared between sources (same URL or perceptually identical) */
  sharedImages: number;
  /** Images unique to Grokipedia */
  uniqueToGrokipedia: MediaAsset[];
  /** Images unique to Wikipedia */
  uniqueToWikipedia: MediaAsset[];
  /** Important images from Wikipedia missing in Grokipedia */
  missingCriticalMedia: MediaAsset[];
  /** Overall image similarity score (0-1) */
  imageSimilarityScore: number;
  /** Overall video similarity score (0-1) */
  videoSimilarityScore: number;
  /** Number of shared videos (same URL) */
  sharedVideos: number;
  /** Videos unique to Grokipedia */
  uniqueVideosToGrokipedia: MediaAsset[];
  /** Videos unique to Wikipedia */
  uniqueVideosToWikipedia: MediaAsset[];
}

/**
 * Comprehensive similarity analysis report
 */
export interface SimilarityReport {
  /** Text similarity metrics */
  text: TextSimilarityScore;
  /** Media comparison results */
  media: MediaComparisonResult;
  /** Overall content alignment score (0-1, weighted combination) */
  overallAlignment: number;
  /** Areas where content diverges significantly (section names or topics) */
  divergenceAreas: string[];
  /** Timestamp of analysis */
  analyzedAt: string;
}

/**
 * Structural analysis of document
 */
export interface DocumentStructure {
  /** Total word count */
  wordCount: number;
  /** Number of top-level sections */
  sectionCount: number;
  /** Section headings */
  headings: string[];
  /** Number of citations/references */
  citationCount: number;
  /** Number of images */
  imageCount: number;
  /** Number of videos */
  videoCount: number;
}
