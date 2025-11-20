import { createHash } from "node:crypto";

interface SourceVersion {
  url: string;
  accessedAt: string;
  pageHash: string;
}

interface WikipediaSourceVersion extends SourceVersion {
  revisionId: string;
}

type GrokipediaSourceVersion = SourceVersion;

export interface SourceVersions {
  grokipedia: GrokipediaSourceVersion;
  wikipedia: WikipediaSourceVersion;
}

export function calculateSHA256(content: string): string {
  const hash = createHash("sha256").update(content, "utf8").digest("hex");
  return `sha256:${hash}`;
}

export function extractWikipediaTitle(url: string): string {
  try {
    const urlObj = new URL(url);

    if (!urlObj.hostname.includes("wikipedia.org")) {
      throw new Error(`Not a Wikipedia URL: ${url}`);
    }

    const wikiMatch = urlObj.pathname.match(/^\/wiki\/(.+)$/);
    if (wikiMatch && wikiMatch[1]) {
      return decodeURIComponent(wikiMatch[1]);
    }

    const titleParam = urlObj.searchParams.get("title");
    if (titleParam) {
      return decodeURIComponent(titleParam);
    }

    throw new Error(`Could not extract title from Wikipedia URL: ${url}`);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Invalid URL format: ${url}`);
    }
    throw error;
  }
}

interface WikipediaRevisionResponse {
  query?: {
    pages?: {
      [pageId: string]: {
        pageid?: number;
        title?: string;
        revisions?: Array<{
          revid: number;
          parentid?: number;
          timestamp?: string;
        }>;
        missing?: boolean;
      };
    };
  };
  error?: {
    code: string;
    info: string;
  };
}

export async function fetchWikipediaRevisionId(title: string): Promise<string> {
  const apiUrl = new URL("https://en.wikipedia.org/w/api.php");
  apiUrl.searchParams.set("action", "query");
  apiUrl.searchParams.set("prop", "revisions");
  apiUrl.searchParams.set("rvprop", "ids");
  apiUrl.searchParams.set("format", "json");
  apiUrl.searchParams.set("titles", title);

  const response = await fetch(apiUrl.toString());

  if (!response.ok) {
    throw new Error(
      `Wikipedia API request failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as WikipediaRevisionResponse;

  if (data.error) {
    throw new Error(`Wikipedia API error: ${data.error.info}`);
  }

  const pages = data.query?.pages;
  if (!pages) {
    throw new Error("Wikipedia API returned no page data");
  }

  const pageId = Object.keys(pages)[0];
  if (!pageId) {
    throw new Error("Wikipedia API returned empty pages object");
  }

  const page = pages[pageId];
  if (!page) {
    throw new Error("Wikipedia API returned invalid page data");
  }

  if (page.missing) {
    throw new Error(`Wikipedia article not found: ${title}`);
  }

  const revisions = page.revisions;
  if (!revisions || revisions.length === 0) {
    throw new Error(`No revisions found for Wikipedia article: ${title}`);
  }

  const revision = revisions[0];
  if (!revision) {
    throw new Error(`No revision data found for Wikipedia article: ${title}`);
  }

  return revision.revid.toString();
}

async function fetchHTML(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url}: ${response.status} ${response.statusText}`
    );
  }

  return await response.text();
}

export async function generateSourceVersions(
  grokipediaUrl: string,
  wikipediaUrl: string
): Promise<SourceVersions> {
  const accessedAt = new Date().toISOString();

  const [grokipediaHTML, wikipediaHTML] = await Promise.all([
    fetchHTML(grokipediaUrl),
    fetchHTML(wikipediaUrl),
  ]);

  const grokipediaHash = calculateSHA256(grokipediaHTML);
  const wikipediaHash = calculateSHA256(wikipediaHTML);

  const wikipediaTitle = extractWikipediaTitle(wikipediaUrl);
  const revisionId = await fetchWikipediaRevisionId(wikipediaTitle);

  return {
    grokipedia: {
      url: grokipediaUrl,
      accessedAt,
      pageHash: grokipediaHash,
    },
    wikipedia: {
      url: wikipediaUrl,
      accessedAt,
      pageHash: wikipediaHash,
      revisionId,
    },
  };
}
