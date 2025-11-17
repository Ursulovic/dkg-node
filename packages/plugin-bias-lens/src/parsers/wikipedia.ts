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
  const referencesMatch = content.match(/References\s*[-]+\s*([\s\S]*?)(\n##|$)/i);
  if (!referencesMatch || !referencesMatch[1]) {
    return refMap;
  }

  const referencesSection = referencesMatch[1];

  // Split by numbered citations (1., 2., 3., etc.)
  // Match pattern: start of line with optional whitespace, number, period
  const citationEntries = referencesSection.split(/^\s*(\d+)\.\s+/m).filter(Boolean);

  // Process pairs of (number, content)
  for (let i = 0; i < citationEntries.length; i += 2) {
    const citationNumber = citationEntries[i]?.trim();
    const citationContent = citationEntries[i + 1];

    if (!citationNumber || !citationContent) continue;

    // Extract URLs from markdown links in this citation
    // Match [text](url) pattern but exclude Wikipedia anchor links
    const urlMatches = citationContent.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);

    for (const match of urlMatches) {
      const url = match[2];

      // Skip if no URL captured
      if (!url) {
        continue;
      }

      // Skip Wikipedia internal anchor links (#cite_ref-X)
      if (url.startsWith("#") || url.includes("wikipedia.org/wiki/")) {
        continue;
      }

      // Skip empty or invalid URLs
      if (!url.match(/^https?:\/\//)) {
        continue;
      }

      // Use the first valid URL for this citation number
      if (!refMap.has(citationNumber)) {
        refMap.set(citationNumber, url);
      }
    }

    // If no markdown link found, try to extract raw URLs
    if (!refMap.has(citationNumber)) {
      const rawUrlMatch = citationContent.match(/(https?:\/\/[^\s)]+)/);
      if (rawUrlMatch && rawUrlMatch[1]) {
        refMap.set(citationNumber, rawUrlMatch[1]);
      }
    }
  }

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

  const citationRegex = /\[\[(\d+)\]\]/g;

  while ((match = citationRegex.exec(content)) !== null) {
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
