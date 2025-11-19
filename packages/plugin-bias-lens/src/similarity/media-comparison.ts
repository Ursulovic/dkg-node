import type { MediaAsset, MediaComparisonResult } from "./types";
import { normalizeMediaUrl, groupMediaByType } from "./media-extractor";

/**
 * Compare media assets between Grokipedia and Wikipedia
 *
 * @param grokMedia - Media assets from Grokipedia
 * @param wikiMedia - Media assets from Wikipedia
 * @returns Comprehensive media comparison results
 */
export async function compareMedia(
  grokMedia: MediaAsset[],
  wikiMedia: MediaAsset[],
): Promise<MediaComparisonResult> {
  // Group by type
  const grokGrouped = groupMediaByType(grokMedia);
  const wikiGrouped = groupMediaByType(wikiMedia);

  // Compare images
  const imageComparison = compareImages(grokGrouped.images, wikiGrouped.images);

  // Compare videos
  const videoComparison = compareVideos(grokGrouped.videos, wikiGrouped.videos);

  return {
    ...imageComparison,
    ...videoComparison,
  };
}

/**
 * Compare images between two sources
 */
function compareImages(
  grokImages: MediaAsset[],
  wikiImages: MediaAsset[],
): Pick<
  MediaComparisonResult,
  | "sharedImages"
  | "uniqueToGrokipedia"
  | "uniqueToWikipedia"
  | "missingCriticalMedia"
  | "imageSimilarityScore"
> {
  // Normalize URLs for comparison
  const grokUrls = new Set(grokImages.map((img) => normalizeMediaUrl(img.url)));
  const wikiUrls = new Set(wikiImages.map((img) => normalizeMediaUrl(img.url)));

  // Find shared images (same URL)
  const sharedUrls = new Set([...grokUrls].filter((url) => wikiUrls.has(url)));
  const sharedImages = sharedUrls.size;

  // Find unique images
  const uniqueToGrokipedia = grokImages.filter(
    (img) => !wikiUrls.has(normalizeMediaUrl(img.url)),
  );

  const uniqueToWikipedia = wikiImages.filter(
    (img) => !grokUrls.has(normalizeMediaUrl(img.url)),
  );

  // Identify critical missing images
  // Heuristic: Images with data/chart/graph/diagram keywords in alt text are critical
  const missingCriticalMedia = uniqueToWikipedia.filter((img) =>
    isCriticalImage(img)
  );

  // Compute similarity score
  const totalImages = grokImages.length + wikiImages.length;
  const imageSimilarityScore = totalImages === 0
    ? 1.0 // No images in either source = perfect similarity
    : (2 * sharedImages) / totalImages; // Jaccard-style similarity

  return {
    sharedImages,
    uniqueToGrokipedia,
    uniqueToWikipedia,
    missingCriticalMedia,
    imageSimilarityScore,
  };
}

/**
 * Compare videos between two sources
 */
function compareVideos(
  grokVideos: MediaAsset[],
  wikiVideos: MediaAsset[],
): Pick<
  MediaComparisonResult,
  | "sharedVideos"
  | "uniqueVideosToGrokipedia"
  | "uniqueVideosToWikipedia"
  | "videoSimilarityScore"
> {
  // Normalize URLs for comparison
  const grokUrls = new Set(
    grokVideos.map((vid) => normalizeVideoUrl(vid.url)),
  );
  const wikiUrls = new Set(
    wikiVideos.map((vid) => normalizeVideoUrl(vid.url)),
  );

  // Find shared videos (same URL)
  const sharedUrls = new Set([...grokUrls].filter((url) => wikiUrls.has(url)));
  const sharedVideos = sharedUrls.size;

  // Find unique videos
  const uniqueVideosToGrokipedia = grokVideos.filter(
    (vid) => !wikiUrls.has(normalizeVideoUrl(vid.url)),
  );

  const uniqueVideosToWikipedia = wikiVideos.filter(
    (vid) => !grokUrls.has(normalizeVideoUrl(vid.url)),
  );

  // Compute similarity score
  const totalVideos = grokVideos.length + wikiVideos.length;
  const videoSimilarityScore = totalVideos === 0
    ? 1.0 // No videos in either source = perfect similarity
    : (2 * sharedVideos) / totalVideos;

  return {
    sharedVideos,
    uniqueVideosToGrokipedia,
    uniqueVideosToWikipedia,
    videoSimilarityScore,
  };
}

/**
 * Determine if an image is critical based on heuristics
 */
function isCriticalImage(image: MediaAsset): boolean {
  const criticalKeywords = [
    "chart",
    "graph",
    "data",
    "diagram",
    "map",
    "comparison",
    "timeline",
    "infographic",
    "statistics",
    "trend",
  ];

  const altText = (image.alt || "").toLowerCase();
  const context = (image.context || "").toLowerCase();

  // Check if alt text or context contains critical keywords
  return criticalKeywords.some(
    (keyword) => altText.includes(keyword) || context.includes(keyword),
  );
}

/**
 * Normalize video URL for comparison (extract video ID)
 */
function normalizeVideoUrl(url: string): string {
  // Extract YouTube video ID
  const youtubeMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/,
  );
  if (youtubeMatch) {
    return `youtube:${youtubeMatch[1]}`;
  }

  // Extract Vimeo video ID
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return `vimeo:${vimeoMatch[1]}`;
  }

  // Fallback to normalized URL
  return normalizeMediaUrl(url);
}

/**
 * Generate a human-readable summary of media comparison
 */
export function summarizeMediaComparison(
  result: MediaComparisonResult,
): string {
  const lines: string[] = [];

  // Image summary
  const totalImages = result.sharedImages +
    result.uniqueToGrokipedia.length +
    result.uniqueToWikipedia.length;
  lines.push(
    `**Images**: ${result.sharedImages} shared / ${totalImages} total (${(result.imageSimilarityScore * 100).toFixed(1)}% similarity)`,
  );

  if (result.missingCriticalMedia.length > 0) {
    lines.push(
      `  ⚠️ **${result.missingCriticalMedia.length} critical images missing** from Grokipedia:`,
    );
    result.missingCriticalMedia.slice(0, 5).forEach((img) => {
      lines.push(`    - ${img.alt || "Unnamed image"}`);
    });
    if (result.missingCriticalMedia.length > 5) {
      lines.push(
        `    - ... and ${result.missingCriticalMedia.length - 5} more`,
      );
    }
  }

  if (result.uniqueToGrokipedia.length > 0) {
    lines.push(
      `  ℹ️ ${result.uniqueToGrokipedia.length} unique images in Grokipedia`,
    );
  }

  // Video summary
  const totalVideos = result.sharedVideos +
    result.uniqueVideosToGrokipedia.length +
    result.uniqueVideosToWikipedia.length;

  if (totalVideos > 0) {
    lines.push(
      `**Videos**: ${result.sharedVideos} shared / ${totalVideos} total (${(result.videoSimilarityScore * 100).toFixed(1)}% similarity)`,
    );

    if (result.uniqueVideosToWikipedia.length > 0) {
      lines.push(
        `  ⚠️ ${result.uniqueVideosToWikipedia.length} videos missing from Grokipedia`,
      );
    }
  }

  return lines.join("\n");
}
