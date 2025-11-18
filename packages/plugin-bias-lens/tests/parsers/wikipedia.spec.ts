import { describe, it, before } from "mocha";
import { expect } from "chai";
import { WikipediaLoader } from "../../src/loaders/wikipedia.js";
import {
  extractLinks,
  extractLinksByType,
} from "../../src/parsers/wikipedia.js";

describe("Wikipedia Parsers", () => {
  let scrapedContent: string;

  before(async function () {
    this.timeout(10000); // Allow more time for network request
    const loader = new WikipediaLoader();
    const result = await loader.loadPage(
      "https://en.wikipedia.org/wiki/Global_warming_potential",
    );
    scrapedContent = result[0].pageContent;
  });

  describe("extractLinks", () => {
    it("should extract all links from scraped content", () => {
      const links = extractLinks(scrapedContent);

      expect(links).to.be.an("array");
      expect(links.length).to.be.greaterThan(0);
    });

    it("should return objects with text, url, and type properties", () => {
      const links = extractLinks(scrapedContent);

      links.forEach((link) => {
        expect(link).to.have.property("text");
        expect(link).to.have.property("url");
        expect(link).to.have.property("type");
        expect(link.text).to.be.a("string");
        expect(link.url).to.be.a("string");
        expect(link.type).to.be.a("string");
      });
    });

    it("should correctly categorize different link types", () => {
      const links = extractLinks(scrapedContent);

      const types = new Set(links.map((l) => l.type));

      expect(types.has("wiki-page")).to.be.true;
      expect(types.has("pdf")).to.be.true;
      // Note: Citations with empty URLs are filtered out, so "citation" type won't appear
      // Citations WITH URLs from References section are classified by their URL type (pdf, html, etc.)
    });
  });

  describe("extractLinksByType", () => {
    it("should extract only image links", () => {
      const images = extractLinksByType(scrapedContent, "image");

      expect(images).to.be.an("array");
      images.forEach((link) => {
        expect(link.type).to.equal("image");
        expect(link.url).to.match(
          /^https?:\/\/.+\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)/i,
        );
      });
    });

    it("should extract only wiki-page links", () => {
      const wikiPages = extractLinksByType(scrapedContent, "wiki-page");

      expect(wikiPages).to.be.an("array");
      expect(wikiPages.length).to.be.greaterThan(0);

      wikiPages.forEach((link) => {
        expect(link.type).to.equal("wiki-page");
        expect(link.url).to.include("wikipedia.org/wiki/");
        expect(link.url).to.not.include('"');
      });
    });

    it("should extract only PDF links", () => {
      const pdfs = extractLinksByType(scrapedContent, "pdf");

      expect(pdfs).to.be.an("array");
      pdfs.forEach((link) => {
        expect(link.type).to.equal("pdf");
        expect(link.url).to.match(/\.pdf(\?|$)/i);
      });
    });

    // Note: Citations without URLs are filtered out as per user request
    // Citations WITH URLs from References section are classified by their URL type (pdf, html, etc.)
    // This test is commented out as "citation" type links with empty URLs are no longer returned

    it("should extract multiple types at once", () => {
      const links = extractLinksByType(scrapedContent, ["pdf", "excel"]);

      links.forEach((link) => {
        expect(["pdf", "excel"]).to.include(link.type);
      });
    });
  });

  describe("Link Type Detection", () => {
    it("should correctly identify wiki-page links", () => {
      const testContent =
        '[Test](https://en.wikipedia.org/wiki/Test "Test title")';
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("wiki-page");
      expect(links[0].url).to.equal("https://en.wikipedia.org/wiki/Test");
      expect(links[0].text).to.equal("Test");
    });

    it("should correctly identify PDF links", () => {
      const testContent = "[PDF Link](https://example.com/document.pdf)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("pdf");
    });

    it("should correctly identify Excel links", () => {
      const testContent = "[Excel Link](https://example.com/data.xlsx)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("excel");
    });

    it("should correctly identify Doc links", () => {
      const testContent = "[Doc Link](https://example.com/report.docx)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("doc");
    });

    it("should correctly identify video links", () => {
      const testContent = "[Video](https://example.com/video.mp4)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("video");
    });

    it("should correctly identify audio links", () => {
      const testContent = "[Audio](https://example.com/audio.mp3)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("audio");
    });

    it("should correctly identify image links", () => {
      const testContent = "![Image](https://example.com/image.png)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("image");
    });

    it("should correctly identify HTML links", () => {
      const testContent = "[HTML Link](https://example.com/page)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("html");
    });

    it("should filter out invalid image URLs", () => {
      const testContent =
        "![alt](not-a-url) ![valid](https://example.com/image.png)";
      const images = extractLinksByType(testContent, "image");

      expect(images).to.have.lengthOf(1);
      expect(images[0].url).to.equal("https://example.com/image.png");
    });

    it("should not include Wikipedia or Wikimedia URLs in external links", () => {
      const links = extractLinks(scrapedContent);

      const externalLinks = links.filter((l) =>
        ["pdf", "html", "excel", "doc"].includes(l.type),
      );

      externalLinks.forEach((link) => {
        expect(link.url).to.not.match(/wikimedia\.org/i);
        expect(link.url).to.not.match(/wikidata\.org/i);
      });
    });

    it("should not include anchor links", () => {
      const testContent = "[Anchor](#section) [Valid](https://example.com)";
      const links = extractLinks(testContent);

      links.forEach((link) => {
        expect(link.url).to.not.match(/^#/);
      });
    });
  });
});
