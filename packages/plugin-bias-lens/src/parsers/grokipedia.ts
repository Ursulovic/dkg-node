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

  if (lowerUrl.includes("grokipedia.com")) {
    return "grok-page";
  }

  if (lowerUrl.includes("wikipedia.org/wiki/")) {
    return "wiki-page";
  }

  // Archive sources (web.archive.org, archive.is, archive.ph, archive.ipcc.ch, etc.)
  if (
    lowerUrl.includes("web.archive.org") ||
    lowerUrl.includes("archive.is") ||
    lowerUrl.includes("archive.ph") ||
    lowerUrl.includes("archive.today") ||
    lowerUrl.includes("archive.ipcc.ch")
  ) {
    return "archive-source";
  }

  // Academic sources (arxiv, DOI, journals)
  if (
    lowerUrl.includes("arxiv.org") ||
    lowerUrl.includes("doi.org") ||
    lowerUrl.includes("nature.com") ||
    lowerUrl.includes("science.org") ||
    lowerUrl.includes("sciencedirect.com") ||
    lowerUrl.includes("springer.com") ||
    lowerUrl.includes("wiley.com") ||
    lowerUrl.includes("nih.gov") ||
    lowerUrl.includes("pmc.ncbi.nlm.nih.gov") ||
    lowerUrl.includes("academic.oup.com") ||
    lowerUrl.includes("journals.") ||
    lowerUrl.includes("iopscience.iop.org") ||
    lowerUrl.includes("agupubs.onlinelibrary.wiley.com") ||
    lowerUrl.includes("repository.") ||
    lowerUrl.includes("essopenarchive.org") ||
    lowerUrl.includes("pnas.org")
  ) {
    return "academic-source";
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

function extractReferenceUrls(content: string): Map<string, string> {
  const refMap = new Map<string, string>();

  // Find the References section
  const referencesIndex = content.indexOf("References");
  if (referencesIndex === -1) {
    return refMap;
  }

  // Extract the section after "References"
  const referencesSection = content.substring(referencesIndex + "References".length);

  // Find the first URL (starts with https://)
  const firstUrlMatch = referencesSection.match(/https:\/\//);
  if (!firstUrlMatch || firstUrlMatch.index === undefined) {
    return refMap;
  }

  // Extract the URL blob (all concatenated URLs)
  const urlBlob = referencesSection.substring(firstUrlMatch.index);

  // Split on "https://" to separate individual URLs
  const urls = urlBlob
    .split(/(?=https:\/\/)/)
    .map((url) => url.trim())
    .filter((url) => url.length > 0)
    .map((url) => {
      // Clean up: remove trailing non-URL characters
      // URLs end before common trailing text like "Edits", "All", "Loading", etc.
      const cleaned = url.match(/^(https:\/\/[^\s]*)/);
      if (cleaned && cleaned[1]) {
        // Remove common trailing patterns that aren't part of URLs
        return cleaned[1].replace(/(Edits|All|EditsAll|Loading|edits\.\.\.)+$/, "");
      }
      return url;
    });

  // Map citation numbers to URLs (1-indexed)
  urls.forEach((url, index) => {
    const citationNumber = (index + 1).toString();
    refMap.set(citationNumber, url);
  });

  return refMap;
}

export function extractLinks(content: string): Link[] {
  const links: Link[] = [];
  const seenCitations = new Set<string>();

  // Extract reference URLs from the References section
  const referenceMap = extractReferenceUrls(content);

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

  // Match both [[1]] (markdown) and [1] (plain text) style citations
  const doubleBracketCitationRegex = /\[\[(\d+)\]\]/g;
  const singleBracketCitationRegex = /\[(\d+)\]/g;

  // First, extract double-bracket citations [[1]]
  while ((match = doubleBracketCitationRegex.exec(content)) !== null) {
    if (match[1] && !seenCitations.has(match[1])) {
      seenCitations.add(match[1]);
      const citationNumber = match[1];
      const url = referenceMap.get(citationNumber) || "";
      const linkType = url ? getLinkType(url, false) : "citation";

      links.push({
        text: citationNumber,
        url,
        type: linkType,
      });
    }
  }

  // Then, extract single-bracket citations [1] (but not markdown links)
  while ((match = singleBracketCitationRegex.exec(content)) !== null) {
    if (match[1] && !seenCitations.has(match[1])) {
      seenCitations.add(match[1]);
      const citationNumber = match[1];
      const url = referenceMap.get(citationNumber) || "";
      const linkType = url ? getLinkType(url, false) : "citation";

      links.push({
        text: citationNumber,
        url,
        type: linkType,
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
