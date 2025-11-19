import { describe, it } from "mocha";
import { expect } from "chai";
import {
  calculateSHA256,
  extractWikipediaTitle,
  fetchWikipediaRevisionId,
  generateSourceVersions,
  type SourceVersions,
} from "../../src/utils/hash.js";

describe("Content Hash Utility", () => {
  describe("calculateSHA256", () => {
    it("should calculate deterministic SHA-256 hash", () => {
      const content = "Hello, world!";
      const hash1 = calculateSHA256(content);
      const hash2 = calculateSHA256(content);

      expect(hash1).to.equal(hash2);
      expect(hash1).to.match(/^sha256:[0-9a-f]{64}$/);
    });

    it("should produce same hash for identical content", () => {
      const content = "The quick brown fox jumps over the lazy dog";
      const hash1 = calculateSHA256(content);
      const hash2 = calculateSHA256(content);

      expect(hash1).to.equal(hash2);
    });

    it("should produce different hashes for different content", () => {
      const content1 = "Content version 1";
      const content2 = "Content version 2";

      const hash1 = calculateSHA256(content1);
      const hash2 = calculateSHA256(content2);

      expect(hash1).to.not.equal(hash2);
    });

    it("should handle empty string", () => {
      const hash = calculateSHA256("");
      expect(hash).to.match(/^sha256:[0-9a-f]{64}$/);
    });

    it("should handle unicode content", () => {
      const content = "Hello 世界! 🌍";
      const hash = calculateSHA256(content);

      expect(hash).to.match(/^sha256:[0-9a-f]{64}$/);
      // Verify deterministic
      expect(calculateSHA256(content)).to.equal(hash);
    });

    it("should produce known hash for known input", () => {
      // Known SHA-256 hash for "test"
      const knownHash =
        "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
      const hash = calculateSHA256("test");

      expect(hash).to.equal(knownHash);
    });
  });

  describe("extractWikipediaTitle", () => {
    it("should extract title from standard /wiki/ URL", () => {
      const url = "https://en.wikipedia.org/wiki/COVID-19";
      const title = extractWikipediaTitle(url);

      expect(title).to.equal("COVID-19");
    });

    it("should extract title with underscores", () => {
      const url = "https://en.wikipedia.org/wiki/Climate_change";
      const title = extractWikipediaTitle(url);

      expect(title).to.equal("Climate_change");
    });

    it("should decode URL-encoded characters", () => {
      const url = "https://en.wikipedia.org/wiki/Caf%C3%A9";
      const title = extractWikipediaTitle(url);

      expect(title).to.equal("Café");
    });

    it("should handle /w/index.php?title= format", () => {
      const url =
        "https://en.wikipedia.org/w/index.php?title=COVID-19&action=edit";
      const title = extractWikipediaTitle(url);

      expect(title).to.equal("COVID-19");
    });

    it("should handle titles with special characters", () => {
      const url =
        "https://en.wikipedia.org/wiki/100%25_renewable_energy";
      const title = extractWikipediaTitle(url);

      expect(title).to.equal("100%_renewable_energy");
    });

    it("should work with different language Wikipedias", () => {
      const url = "https://de.wikipedia.org/wiki/Deutschland";
      const title = extractWikipediaTitle(url);

      expect(title).to.equal("Deutschland");
    });

    it("should throw error for non-Wikipedia URL", () => {
      const url = "https://example.com/wiki/Something";

      expect(() => extractWikipediaTitle(url)).to.throw(
        "Not a Wikipedia URL"
      );
    });

    it("should throw error for Wikipedia URL without title", () => {
      const url = "https://en.wikipedia.org/";

      expect(() => extractWikipediaTitle(url)).to.throw(
        "Could not extract title"
      );
    });

    it("should throw error for invalid URL format", () => {
      const url = "not-a-valid-url";

      expect(() => extractWikipediaTitle(url)).to.throw("Invalid URL format");
    });
  });

  describe("fetchWikipediaRevisionId", () => {
    it("should fetch real revision ID for existing article", async function () {
      this.timeout(10000); // Network request

      const title = "Climate_change";
      const revisionId = await fetchWikipediaRevisionId(title);

      expect(revisionId).to.be.a("string");
      expect(revisionId).to.match(/^\d+$/); // Should be numeric string
      expect(parseInt(revisionId, 10)).to.be.greaterThan(0);
    });

    it("should fetch revision ID for article with special characters", async function () {
      this.timeout(10000);

      const title = "COVID-19";
      const revisionId = await fetchWikipediaRevisionId(title);

      expect(revisionId).to.be.a("string");
      expect(revisionId).to.match(/^\d+$/);
    });

    it("should throw error for non-existent article", async function () {
      this.timeout(10000);

      const title = "This_Article_Does_Not_Exist_12345xyz";

      try {
        await fetchWikipediaRevisionId(title);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include("No revisions found");
      }
    });

    it("should return different revision IDs for different articles", async function () {
      this.timeout(15000);

      const revisionId1 = await fetchWikipediaRevisionId("Climate_change");
      const revisionId2 = await fetchWikipediaRevisionId("Global_warming");

      expect(revisionId1).to.not.equal(revisionId2);
    });
  });

  describe("generateSourceVersions", () => {
    it("should generate complete source versions structure", async function () {
      this.timeout(15000);

      const grokUrl = "https://grokipedia.com/page/Climate_change";
      const wikiUrl = "https://en.wikipedia.org/wiki/Climate_change";

      const result = await generateSourceVersions(grokUrl, wikiUrl);

      // Validate structure
      expect(result).to.have.property("grokipedia");
      expect(result).to.have.property("wikipedia");

      // Validate Grokipedia version
      expect(result.grokipedia).to.have.property("url");
      expect(result.grokipedia).to.have.property("accessedAt");
      expect(result.grokipedia).to.have.property("pageHash");
      expect(result.grokipedia.url).to.equal(grokUrl);
      expect(result.grokipedia.pageHash).to.match(/^sha256:[0-9a-f]{64}$/);

      // Validate Wikipedia version
      expect(result.wikipedia).to.have.property("url");
      expect(result.wikipedia).to.have.property("accessedAt");
      expect(result.wikipedia).to.have.property("pageHash");
      expect(result.wikipedia).to.have.property("revisionId");
      expect(result.wikipedia.url).to.equal(wikiUrl);
      expect(result.wikipedia.pageHash).to.match(/^sha256:[0-9a-f]{64}$/);
      expect(result.wikipedia.revisionId).to.match(/^\d+$/);
    });

    it("should use same timestamp for both sources", async function () {
      this.timeout(15000);

      const result = await generateSourceVersions(
        "https://grokipedia.com/page/Climate_change",
        "https://en.wikipedia.org/wiki/Climate_change"
      );

      expect(result.grokipedia.accessedAt).to.equal(
        result.wikipedia.accessedAt
      );

      // Validate ISO 8601 format
      const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      expect(result.grokipedia.accessedAt).to.match(isoRegex);
      expect(result.wikipedia.accessedAt).to.match(isoRegex);
    });

    it("should calculate different hashes for different pages", async function () {
      this.timeout(15000);

      const result = await generateSourceVersions(
        "https://grokipedia.com/page/Climate_change",
        "https://en.wikipedia.org/wiki/Climate_change"
      );

      // Different sources should have different HTML content
      expect(result.grokipedia.pageHash).to.not.equal(
        result.wikipedia.pageHash
      );
    });

    it("should hash fetched HTML content", async function () {
      this.timeout(15000);

      const grokUrl = "https://grokipedia.com/page/Climate_change";
      const wikiUrl = "https://en.wikipedia.org/wiki/Climate_change";

      const result = await generateSourceVersions(grokUrl, wikiUrl);

      // Verify hashes are valid (content may change between fetches due to dynamic elements)
      expect(result.grokipedia.pageHash).to.be.a("string");
      expect(result.grokipedia.pageHash).to.match(/^sha256:[0-9a-f]{64}$/);
      expect(result.wikipedia.pageHash).to.be.a("string");
      expect(result.wikipedia.pageHash).to.match(/^sha256:[0-9a-f]{64}$/);
    });

    it("should fetch real HTML and calculate valid hashes", async function () {
      this.timeout(15000);

      const result = await generateSourceVersions(
        "https://grokipedia.com/page/Global_warming_potential",
        "https://en.wikipedia.org/wiki/Global_warming"
      );

      // Verify hashes are valid SHA-256 format
      expect(result.grokipedia.pageHash).to.match(/^sha256:[0-9a-f]{64}$/);
      expect(result.wikipedia.pageHash).to.match(/^sha256:[0-9a-f]{64}$/);

      // Verify Wikipedia revision ID
      expect(result.wikipedia.revisionId).to.be.a("string");
      expect(result.wikipedia.revisionId).to.match(/^\d+$/);
      expect(parseInt(result.wikipedia.revisionId, 10)).to.be.greaterThan(0);
    });

    it("should throw error for invalid Wikipedia URL", async function () {
      this.timeout(10000);

      try {
        await generateSourceVersions(
          "https://grokipedia.com/page/Climate_change",
          "https://example.com/not-wikipedia"
        );
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        // Error can be either from fetch or from Wikipedia URL validation
        const errorMsg = (error as Error).message;
        expect(
          errorMsg.includes("Wikipedia") || errorMsg.includes("Failed to fetch")
        ).to.be.true;
      }
    });

    it("should throw error if fetching fails", async function () {
      this.timeout(10000);

      try {
        await generateSourceVersions(
          "https://grokipedia.com/page/NonExistentPage12345xyz",
          "https://en.wikipedia.org/wiki/Climate_change"
        );
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include("Failed to fetch");
      }
    });

    it("should include correct URLs in result", async function () {
      this.timeout(15000);

      const grokUrl = "https://grokipedia.com/page/COVID-19";
      const wikiUrl = "https://en.wikipedia.org/wiki/COVID-19";

      const result = await generateSourceVersions(grokUrl, wikiUrl);

      expect(result.grokipedia.url).to.equal(grokUrl);
      expect(result.wikipedia.url).to.equal(wikiUrl);
    });
  });
});
