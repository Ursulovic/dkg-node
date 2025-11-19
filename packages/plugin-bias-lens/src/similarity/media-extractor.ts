import type { MediaAsset } from "./types";

/**
 * Regular expressions for matching media in markdown
 */
const IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
const VIDEO_EMBED_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/|vimeo\.com\/)([a-zA-Z0-9_-]+)/g;

/**
 * Extract all media assets from markdown content
 *
 * @param markdown - The markdown content to parse
 * @returns Array of extracted media assets
 */
export function extractMediaFromContent(markdown: string): MediaAsset[] {
  const mediaAssets: MediaAsset[] = [];

  // Extract images
  const images = extractImages(markdown);
  mediaAssets.push(...images);

  // Extract videos (embedded links)
  const videos = extractVideos(markdown);
  mediaAssets.push(...videos);

  return mediaAssets;
}

/**
 * Extract image URLs and metadata from markdown
 */
function extractImages(markdown: string): MediaAsset[] {
  const images: MediaAsset[] = [];
  const lines = markdown.split("\n");
  let position = 0;

  // Reset regex state
  IMAGE_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = IMAGE_REGEX.exec(markdown)) !== null) {
    const alt = match[1] || "";
    const url = match[2] || "";

    // Find the context (paragraph containing this image)
    const context = extractContext(markdown, match.index);

    images.push({
      type: "image",
      url,
      alt,
      context,
      position: position++,
    });
  }

  return images;
}

/**
 * Extract video embed URLs from markdown
 */
function extractVideos(markdown: string): MediaAsset[] {
  const videos: MediaAsset[] = [];
  const seen = new Set<string>();
  let position = 0;

  // Reset regex state
  VIDEO_EMBED_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = VIDEO_EMBED_REGEX.exec(markdown)) !== null) {
    const url = match[0];

    // Avoid duplicates
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);

    // Determine video platform
    const alt = url.includes("youtube") || url.includes("youtu.be")
      ? "YouTube video"
      : url.includes("vimeo")
      ? "Vimeo video"
      : "Video";

    // Find the context
    const context = extractContext(markdown, match.index);

    videos.push({
      type: "video",
      url,
      alt,
      context,
      position: position++,
    });
  }

  return videos;
}

/**
 * Extract surrounding text context for a media asset
 *
 * @param markdown - Full markdown content
 * @param index - Position of the media in the markdown
 * @returns Surrounding paragraph or section
 */
function extractContext(markdown: string, index: number): string {
  // Find the paragraph containing this media
  const beforeMedia = markdown.substring(0, index);
  const afterMedia = markdown.substring(index);

  // Look for paragraph boundaries (double newline)
  const paragraphStart = beforeMedia.lastIndexOf("\n\n");
  const paragraphEnd = afterMedia.indexOf("\n\n");

  const startIndex = paragraphStart === -1 ? 0 : paragraphStart + 2;
  const endIndex = paragraphEnd === -1
    ? markdown.length
    : index + paragraphEnd;

  let context = markdown.substring(startIndex, endIndex).trim();

  // Remove the media markdown itself from context
  context = context.replace(IMAGE_REGEX, "").replace(VIDEO_EMBED_REGEX, "");

  // Limit context length
  if (context.length > 300) {
    context = context.substring(0, 300) + "...";
  }

  return context;
}

/**
 * Group media assets by type
 */
export function groupMediaByType(media: MediaAsset[]): {
  images: MediaAsset[];
  videos: MediaAsset[];
} {
  return {
    images: media.filter((m) => m.type === "image"),
    videos: media.filter((m) => m.type === "video"),
  };
}

/**
 * Check if two media assets have the same URL (exact match)
 */
export function isSameMedia(asset1: MediaAsset, asset2: MediaAsset): boolean {
  return asset1.url === asset2.url;
}

/**
 * Normalize URL for comparison (remove query params, trailing slashes, etc.)
 */
export function normalizeMediaUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove query parameters and hash
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    // If URL parsing fails, return as-is
    return url.replace(/\/$/, "");
  }
}
