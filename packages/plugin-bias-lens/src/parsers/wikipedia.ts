export type LinkType =
  | "wiki-page"
  | "grok-page"
  | "academic-source"
  | "archive-source"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "doc"
  | "excel"
  | "html"
  | "citation"
  | "other";

export interface Link {
  text: string;
  url: string;
  type: LinkType;
}

function getLinkType(url: string, isImage: boolean): LinkType {
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes("wikipedia.org/wiki/")) {
    return "wiki-page";
  }

  if (isImage || lowerUrl.match(/\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)(\?|$)/i)) {
    return "image";
  }

  if (lowerUrl.match(/\.(mp4|webm|mov|avi|mkv|flv)(\?|$)/i)) {
    return "video";
  }

  if (lowerUrl.match(/\.(mp3|wav|ogg|flac|aac|m4a)(\?|$)/i)) {
    return "audio";
  }

  if (lowerUrl.match(/\.pdf(\?|$)/i)) {
    return "pdf";
  }

  if (lowerUrl.match(/\.(doc|docx)(\?|$)/i)) {
    return "doc";
  }

  if (lowerUrl.match(/\.(xls|xlsx)(\?|$)/i)) {
    return "excel";
  }

  if (lowerUrl.match(/^https?:\/\/.+/)) {
    return "html";
  }

  return "other";
}

function isValidImageUrl(url: string): boolean {
  if (!url || url.trim() === "") {
    return false;
  }

  try {
    new URL(url);
    return /^https?:\/\/.+\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)/i.test(url);
  } catch {
    return false;
  }
}

export function extractLinks(content: string): Link[] {
  const links: Link[] = [];
  const seenCitations = new Set<string>();

  const linkedImageRegex = /\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g;
  let match: RegExpExecArray | null;

  while ((match = linkedImageRegex.exec(content)) !== null) {
    const url = match[2] || "";
    if (isValidImageUrl(url)) {
      links.push({
        text: match[1] || "",
        url,
        type: "image",
      });
    }
  }

  const imageRegex = /(?<!\[)!\[([^\]]*)\]\(([^)]+)\)/g;

  while ((match = imageRegex.exec(content)) !== null) {
    const url = match[2] || "";
    if (isValidImageUrl(url)) {
      links.push({
        text: match[1] || "",
        url,
        type: "image",
      });
    }
  }

  const linkRegex = /(?<!!)\[([^\]]+)\]\(([^\s)"]+)/g;

  while ((match = linkRegex.exec(content)) !== null) {
    const text = match[1] || "";
    const url = match[2] || "";

    const isWikimediaOrAnchor =
      /(?:wikimedia\.org|wikidata\.org)/i.test(url) ||
      url.startsWith("#") ||
      !url.match(/^https?:\/\//);

    if (!isWikimediaOrAnchor && url) {
      links.push({
        text,
        url,
        type: getLinkType(url, false),
      });
    }
  }

  const citationRegex = /\[\[(\d+)\]\]/g;

  while ((match = citationRegex.exec(content)) !== null) {
    if (match[1] && !seenCitations.has(match[1])) {
      seenCitations.add(match[1]);
      links.push({
        text: match[1],
        url: "",
        type: "citation",
      });
    }
  }

  return links;
}

export function extractLinksByType(
  content: string,
  types: LinkType | LinkType[],
): Link[] {
  const allLinks = extractLinks(content);
  const typeArray = Array.isArray(types) ? types : [types];

  return allLinks.filter((link) => typeArray.includes(link.type));
}
