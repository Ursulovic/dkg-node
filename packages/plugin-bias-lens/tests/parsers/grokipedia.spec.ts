import { describe, it, before } from "mocha";
import { expect } from "chai";
import { GrokipediaLoader } from "../../src/loaders/grokipedia.js";
import {
  extractLinks,
  extractLinksByType,
} from "../../src/parsers/grokipedia.js";

describe("Grokipedia Parsers", () => {
  let scrapedContent: string;

  before(async function () {
    this.timeout(10000); // Allow more time for network request
    const loader = new GrokipediaLoader();
    const url = "https://grokipedia.com/page/Global_warming_potential";
    const result = await loader.loadPage(url);
    scrapedContent = result[0].pageContent;
  });

  describe("extractLinks", () => {
    it("should extract all links from Grokipedia content", () => {
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

    it("should extract citations from real Grokipedia content with reference URLs", () => {
      const links = extractLinks(scrapedContent);
      const types = new Set(links.map((l) => l.type));

      // Real Grokipedia content has citations linked to reference URLs
      // Citations are typed based on their URL (archive-source, academic-source, pdf, html)
      expect(types.has("archive-source")).to.be.true;
      expect(types.has("academic-source")).to.be.true;
      expect(types.has("pdf")).to.be.true;

      // All links should be numbered citations
      expect(links.length).to.be.greaterThan(60);

      // Citations should have numbers as text and URLs
      links.forEach((link) => {
        expect(link.text).to.match(/^\d+$/);
        expect(link.url).to.match(/^https:\/\//);
      });
    });
  });

  describe("extractLinksByType", () => {
    // Use synthetic markdown content for link extraction tests since
    // real Grokipedia content is plain text
    const MARKDOWN_TEST_CONTENT = `
      Test content with various links:
      [Grok Article](https://grokipedia.com/article/test)
      [Nature Paper](https://www.nature.com/articles/12345)
      [ArXiv](https://arxiv.org/abs/2103.12345)
      [DOI](https://doi.org/10.1088/test)
      [Archive](https://web.archive.org/web/20230101/test)
      [IPCC Archive](https://archive.ipcc.ch/reports/test.pdf)
      [Wikipedia](https://en.wikipedia.org/wiki/Climate_change)
      [PDF](https://example.com/doc.pdf)
      ![Image](https://example.com/image.png)
      Citations: [[1]] [[2]] [[3]]
    `;

    it("should extract only grok-page links", () => {
      const grokPages = extractLinksByType(MARKDOWN_TEST_CONTENT, "grok-page");

      expect(grokPages).to.be.an("array");
      expect(grokPages.length).to.be.greaterThan(0);

      grokPages.forEach((link) => {
        expect(link.type).to.equal("grok-page");
        expect(link.url).to.include("grokipedia.com");
      });
    });

    it("should extract only academic-source links", () => {
      const academicSources = extractLinksByType(
        MARKDOWN_TEST_CONTENT,
        "academic-source",
      );

      expect(academicSources).to.be.an("array");
      expect(academicSources.length).to.be.greaterThan(0);

      academicSources.forEach((link) => {
        expect(link.type).to.equal("academic-source");
        const hasAcademicDomain =
          link.url.includes("nature.com") ||
          link.url.includes("arxiv.org") ||
          link.url.includes("doi.org");
        expect(hasAcademicDomain).to.be.true;
      });
    });

    it("should extract only archive-source links", () => {
      const archiveSources = extractLinksByType(
        MARKDOWN_TEST_CONTENT,
        "archive-source",
      );

      expect(archiveSources).to.be.an("array");
      expect(archiveSources.length).to.be.greaterThan(0);

      archiveSources.forEach((link) => {
        expect(link.type).to.equal("archive-source");
        const hasArchiveDomain =
          link.url.includes("web.archive.org") ||
          link.url.includes("archive.ipcc.ch");
        expect(hasArchiveDomain).to.be.true;
      });
    });

    it("should extract only wiki-page links", () => {
      const wikiPages = extractLinksByType(MARKDOWN_TEST_CONTENT, "wiki-page");

      expect(wikiPages).to.be.an("array");
      expect(wikiPages.length).to.be.greaterThan(0);

      wikiPages.forEach((link) => {
        expect(link.type).to.equal("wiki-page");
        expect(link.url).to.include("wikipedia.org/wiki/");
      });
    });

    it("should extract archive sources from real Grokipedia content", () => {
      const archiveSources = extractLinksByType(
        scrapedContent,
        "archive-source",
      );

      expect(archiveSources).to.be.an("array");
      expect(archiveSources.length).to.be.greaterThan(0);

      archiveSources.forEach((link) => {
        expect(link.type).to.equal("archive-source");
        expect(link.text).to.match(/^\d+$/); // Citation numbers
        expect(link.url).to.include("archive.ipcc.ch");
      });
    });

    it("should extract academic sources from real Grokipedia content", () => {
      const academicSources = extractLinksByType(
        scrapedContent,
        "academic-source",
      );

      expect(academicSources).to.be.an("array");
      expect(academicSources.length).to.be.greaterThan(0);

      academicSources.forEach((link) => {
        expect(link.type).to.equal("academic-source");
        expect(link.text).to.match(/^\d+$/); // Citation numbers
        expect(link.url).to.match(/^https:\/\//);
      });
    });

    it("should extract only PDF links", () => {
      const pdfs = extractLinksByType(MARKDOWN_TEST_CONTENT, "pdf");

      expect(pdfs).to.be.an("array");
      expect(pdfs.length).to.be.greaterThan(0);
      pdfs.forEach((link) => {
        expect(link.type).to.equal("pdf");
        expect(link.url).to.match(/\.pdf(\?|$)/i);
      });
    });

    it("should extract only image links", () => {
      const images = extractLinksByType(MARKDOWN_TEST_CONTENT, "image");

      expect(images).to.be.an("array");
      expect(images.length).to.be.greaterThan(0);
      images.forEach((link) => {
        expect(link.type).to.equal("image");
        expect(link.url).to.match(
          /^https?:\/\/.+\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)/i,
        );
      });
    });

    it("should extract multiple types at once", () => {
      const links = extractLinksByType(MARKDOWN_TEST_CONTENT, [
        "grok-page",
        "academic-source",
        "archive-source",
      ]);

      expect(links.length).to.be.greaterThan(0);
      links.forEach((link) => {
        expect(["grok-page", "academic-source", "archive-source"]).to.include(
          link.type,
        );
      });
    });
  });

  describe("Link Type Detection - New Grokipedia Types", () => {
    it("should correctly identify grok-page links", () => {
      const testContent =
        "[Climate Change](https://grokipedia.com/article/climate-change)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("grok-page");
      expect(links[0].url).to.equal(
        "https://grokipedia.com/article/climate-change",
      );
      expect(links[0].text).to.equal("Climate Change");
    });

    it("should correctly identify arxiv.org as academic-source", () => {
      const testContent = "[Paper](https://arxiv.org/abs/2103.12345)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("academic-source");
    });

    it("should correctly identify doi.org as academic-source", () => {
      const testContent = "[DOI](https://doi.org/10.1088/1748-9326/ac4940)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("academic-source");
    });

    it("should correctly identify nature.com as academic-source", () => {
      const testContent =
        "[Nature Article](https://www.nature.com/articles/s43247-023-00857-8)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("academic-source");
    });

    it("should correctly identify web.archive.org as archive-source", () => {
      const testContent =
        "[Archived](https://web.archive.org/web/20230101/https://example.com)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("archive-source");
    });

    it("should correctly identify archive.ipcc.ch as archive-source", () => {
      const testContent =
        "[IPCC Archive](https://archive.ipcc.ch/ipccreports/tar/wg1/247.htm)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("archive-source");
    });

    it("should prioritize grok-page over other types", () => {
      const testContent = "[Grok](https://grokipedia.com/climate.pdf)"; // .pdf extension but grokipedia domain
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("grok-page"); // Domain detection comes first
    });

    it("should prioritize wiki-page over academic for Wikipedia", () => {
      const testContent =
        "[Wiki](https://en.wikipedia.org/wiki/Climate_change)";
      const links = extractLinks(testContent);

      expect(links).to.have.lengthOf(1);
      expect(links[0].type).to.equal("wiki-page");
    });
  });

  describe("Link Type Detection - Original Types", () => {
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
      const testContent = `
        [External](https://example.com)
        [Wikimedia](https://upload.wikimedia.org/image.png)
        [Wikidata](https://www.wikidata.org/wiki/Q123)
      `;
      const links = extractLinks(testContent);

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

  describe("Citation Extraction", () => {
    it("should extract citations with proper format", () => {
      const testContent = "Text with citation[[1]] and another[[2]][[3]]";
      const citations = extractLinksByType(testContent, "citation");

      expect(citations).to.have.lengthOf(3);
      expect(citations[0].text).to.equal("1");
      expect(citations[1].text).to.equal("2");
      expect(citations[2].text).to.equal("3");
    });

    it("should deduplicate citations", () => {
      const testContent = "Citation[[1]] appears twice[[1]]";
      const citations = extractLinksByType(testContent, "citation");

      expect(citations).to.have.lengthOf(1);
      expect(citations[0].text).to.equal("1");
    });

    it("should handle multi-digit citations", () => {
      const testContent = "Citation[[123]]";
      const citations = extractLinksByType(testContent, "citation");

      expect(citations).to.have.lengthOf(1);
      expect(citations[0].text).to.equal("123");
    });
  });
});
