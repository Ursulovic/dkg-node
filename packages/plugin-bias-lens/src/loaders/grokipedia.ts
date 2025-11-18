import { randomUUID } from "node:crypto";
import { Document } from "@langchain/core/documents";
import { load as cheerioLoad, type CheerioAPI } from "cheerio";
import TurndownService from "turndown";
import { tables } from "@joplin/turndown-plugin-gfm";

interface GrokipediaMetadata {
  source: string;
  title: string;
}

type GrokipediaDocument = Document<GrokipediaMetadata> & { id: string };

export class GrokipediaLoader {
  static baseUrl = "https://grokipedia.com";
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });

    // Remove style tags to prevent CSS from appearing in markdown
    this.turndownService.remove("style");

    // Use GitHub Flavored Markdown tables plugin for proper table conversion
    this.turndownService.use(tables);

    // Add rule to convert relative and protocol-relative links to absolute
    this.turndownService.addRule("absoluteLinks", {
      filter: (node) => {
        return (
          node.nodeName === "A" &&
          node.getAttribute("href") !== null &&
          !node.getAttribute("href")!.startsWith("http")
        );
      },
      replacement: (content, node) => {
        let href = (node as HTMLAnchorElement).getAttribute("href") || "";

        // Convert protocol-relative URLs to absolute (//example.com -> https://example.com)
        if (href.startsWith("//")) {
          href = `https:${href}`;
        }
        // Convert Grokipedia relative links to absolute
        else if (href.startsWith("/")) {
          href = `${GrokipediaLoader.baseUrl}${href}`;
        }

        return `[${content}](${href})`;
      },
    });

    // Add rule to convert protocol-relative image URLs to absolute
    this.turndownService.addRule("absoluteImages", {
      filter: "img",
      replacement: (content, node) => {
        const alt = (node as HTMLImageElement).getAttribute("alt") || "";
        let src = (node as HTMLImageElement).getAttribute("src") || "";

        // Convert protocol-relative URLs to absolute (//example.com -> https://example.com)
        if (src.startsWith("//")) {
          src = `https:${src}`;
        }

        return `![${alt}](${src})`;
      },
    });

    // Add rule to convert Grokipedia citations to [[n]] format
    this.turndownService.addRule("grokipediaCitations", {
      filter: (node) => {
        return (
          node.nodeName === "SUP" &&
          node.getAttribute("type") === "button" &&
          /^\[\d+\]$/.test(node.textContent || "")
        );
      },
      replacement: (content, node) => {
        // Extract citation number from content like "[1]"
        const match = (node.textContent || "").match(/\[(\d+)\]/);
        if (match) {
          return `[[${match[1]}]]`;
        }
        return content;
      },
    });
  }

  /**
   * Preprocesses Grokipedia HTML to improve conversion quality.
   * Removes navigation elements and extracts reference URLs.
   */
  private preprocessGrokipediaContent(
    $: CheerioAPI,
  ): { title: string; referenceUrls: Map<string, string> } {
    // Extract title from h1
    const title = $("h1").first().text().trim();

    // Extract reference URLs from the References section BEFORE removing elements
    const referenceUrls = new Map<string, string>();
    $("#references li[id]").each((index, li) => {
      const url = $(li).attr("id") || "";
      if (url) {
        // Map citation number (1-indexed) to URL
        const citationNumber = (index + 1).toString();
        referenceUrls.set(citationNumber, url);
      }
    });

    // Remove navigation elements (table of contents sidebar)
    $("nav").remove();

    // Remove Schema.org metadata tags
    $("meta[itemprop]").remove();

    return { title, referenceUrls };
  }

  async loadPage(url: string): Promise<GrokipediaDocument[]> {
    if (!this.isValidUrl(url)) {
      throw new Error(`Invalid Grokipedia URL: ${url}`);
    }

    // Fetch HTML directly
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Grokipedia page: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();

    // Use Cheerio to select the article content
    const $ = cheerioLoad(html);
    const articleHtml = $("body > article").html() || "";

    // Preprocess with Cheerio before Turndown conversion
    const $article = cheerioLoad(articleHtml);
    const { title, referenceUrls } = this.preprocessGrokipediaContent($article);

    // Convert preprocessed HTML to Markdown
    let markdown = this.turndownService.turndown($article.html() || "");

    // Append References section in markdown format with extracted URLs
    if (referenceUrls.size > 0) {
      markdown += "\n\n## References\n\n";
      Array.from(referenceUrls.entries()).forEach(([num, refUrl]) => {
        markdown += `${num}. [${refUrl}](${refUrl})\n`;
      });
    }

    return [
      {
        id: randomUUID(),
        metadata: {
          source: url,
          title: title,
        },
        pageContent: markdown,
      },
    ];
  }

  private isValidUrl(value: string) {
    try {
      const url = new URL(value);

      if (url.host !== "grokipedia.com") {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}
