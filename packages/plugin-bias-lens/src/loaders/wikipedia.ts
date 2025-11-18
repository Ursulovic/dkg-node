import { randomUUID } from "node:crypto";
import { Document } from "@langchain/core/documents";
import { load as cheerioLoad, type CheerioAPI } from "cheerio";
import TurndownService from "turndown";
import { tables } from "@joplin/turndown-plugin-gfm";

export interface WikipediaMetadata {
  source: string;
}

export type WikipediaDocument = Document<WikipediaMetadata> & { id: string };

export class WikipediaLoader {
  static baseUrl = "https://en.wikipedia.org";
  private turndownService: TurndownService;

  constructor() {
    this.turndownService = new TurndownService();

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
        // Convert Wikipedia relative links to absolute (/wiki/... -> https://en.wikipedia.org/wiki/...)
        else if (href.startsWith("/wiki/")) {
          href = `${WikipediaLoader.baseUrl}${href}`;
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

    // Add rule to convert Wikipedia citations to [[n]] format
    this.turndownService.addRule("wikipediaCitations", {
      filter: (node) => {
        return (
          node.nodeName === "SUP" &&
          (node.classList.contains("reference") ||
            node.id?.startsWith("cite_ref-"))
        );
      },
      replacement: (content, node) => {
        // Extract citation number from the id attribute: cite_ref-NUMBER
        const id = (node as HTMLElement).id || "";
        const match = id.match(/cite_ref-(\d+)/);
        if (match) {
          return `[[${match[1]}]]`;
        }
        // Fallback: try to extract from content like "[1]"
        const contentMatch = content.match(/\[(\d+)\]/);
        if (contentMatch) {
          return `[[${contentMatch[1]}]]`;
        }
        return content;
      },
    });
  }

  /**
   * Preprocesses Wikipedia HTML to improve table conversion quality.
   * Removes navigation boxes and flattens complex table headers.
   */
  private preprocessWikipediaContent($: CheerioAPI): void {
    // Remove Wikipedia navigation boxes and UI chrome
    // These are not article content and clutter the markdown output
    $(
      "table.navbox, table.navbox-subgroup, table[class*='navbox'], " +
        "table.metadata, table.sistersitebox, table.mbox-small",
    ).remove();

    // Fix wikitables: flatten complex header structures for better markdown conversion
    $("table th").each((_, th) => {
      const $th = $(th);

      // Flatten nested p tags - extract text content only
      $th.find("p").each((_, p) => {
        const $p = $(p);
        $p.replaceWith($p.text() + " ");
      });

      // Remove citation markup in headers (not useful in markdown)
      $th.find("sup.reference, sup.nowrap").remove();

      // Remove hidden sort keys used by Wikipedia's sortable tables
      $th.find("span[data-sort-value]").remove();

      // Clean up whitespace
      const text = $th.text().replace(/\s+/g, " ").trim();
      $th.text(text);
    });

    // Also remove sort keys from table cells
    $("table td span[data-sort-value]").remove();
  }

  async loadPage(url: string): Promise<WikipediaDocument[]> {
    // Fetch HTML directly
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch Wikipedia page: ${response.status} ${response.statusText}`,
      );
    }

    const html = await response.text();

    // Use Cheerio to select the article content
    const $ = cheerioLoad(html);
    const articleHtml = $("#mw-content-text .mw-parser-output").html() || "";

    // Preprocess with Cheerio before Turndown conversion
    const $article = cheerioLoad(articleHtml);
    this.preprocessWikipediaContent($article);

    // Convert preprocessed HTML to Markdown
    const markdown = this.turndownService.turndown($article.html() || "");

    return [
      {
        id: randomUUID(),
        metadata: {
          source: url.toString(),
        },
        pageContent: markdown,
      },
    ];
  }
}
