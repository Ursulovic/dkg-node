import { describe, it } from "mocha";
import { expect } from "chai";
import { WikipediaLoader } from "../../src/loaders/wikipedia.js";

describe("WikipediaLoader", () => {
  const loader = new WikipediaLoader();

  describe("loadPage", () => {
    it("should return result for a valid Wikipedia URL", async function () {
      this.timeout(20_000);
      const result = await loader.loadPage(
        "https://en.wikipedia.org/wiki/Global_warming_potential",
      );

      expect(result).to.be.an("array");
      expect(result.length).to.equal(1);
      expect(result[0]).to.have.property("pageContent");
      expect(result[0]).to.have.property("id");
      expect(result[0]).to.have.property("metadata");
    });

    it("should include a valid UUID as document id", async function () {
      this.timeout(10000);
      const result = await loader.loadPage(
        "https://en.wikipedia.org/wiki/Climate_change",
      );

      expect(result[0].id).to.be.a("string");
      // UUID v4 format validation
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result[0].id).to.match(uuidRegex);
    });

    it("should include source URL in metadata", async function () {
      this.timeout(10000);
      const query = "Global warming potential";
      const result = await loader.query(query);

      expect(result[0].metadata).to.have.property("source");
      expect(result[0].metadata.source).to.equal(url);
    });

    it("should return non-empty page content", async function () {
      this.timeout(10000);
      const result = await loader.query("Global warming potential");

      expect(result[0].pageContent).to.be.a("string");
      expect(result[0].pageContent.length).to.be.greaterThan(0);
    });

    it("should generate unique IDs for different pages", async function () {
      this.timeout(15000);
      const result1 = await loader.loadPage(
        "https://en.wikipedia.org/wiki/Climate",
      );
      const result2 = await loader.loadPage(
        "https://en.wikipedia.org/wiki/Weather",
      );

      expect(result1[0].id).to.not.equal(result2[0].id);
    });

    it("should throw error for non-existent pages", async function () {
      this.timeout(10000);
      const nonExistentUrl =
        "https://en.wikipedia.org/wiki/ThisPageDoesNotExist12345XYZ";

      try {
        await loader.loadPage(nonExistentUrl);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.an("error");
        expect((error as Error).message).to.include(
          "Failed to fetch Wikipedia page",
        );
      }
    });
  });

  describe("Content Quality", () => {
    it("should convert protocol-relative image URLs to absolute", async function () {
      this.timeout(10000);
      const result = await loader.loadPage(
        "https://en.wikipedia.org/wiki/Global_warming_potential",
      );

      // Should not contain protocol-relative URLs
      expect(result[0].pageContent).to.not.include("](//upload.wikimedia.org");
      expect(result[0].pageContent).to.not.include("](//upload.wikipedia.org");

      // Should contain absolute URLs instead
      expect(result[0].pageContent).to.include(
        "](https://upload.wikimedia.org",
      );
    });

    it("should convert tables to markdown format", async function () {
      this.timeout(10000);
      const result = await loader.loadPage(
        "https://en.wikipedia.org/wiki/Global_warming_potential",
      );

      // Should contain markdown table syntax (pipes and dashes)
      expect(result[0].pageContent).to.match(/\|.*\|/);
      expect(result[0].pageContent).to.match(/\|[\s-]+\|/);
    });

    it("should not contain CSS code", async function () {
      this.timeout(10000);
      const result = await loader.loadPage(
        "https://en.wikipedia.org/wiki/Global_warming_potential",
      );

      // Should not contain .mw-parser-output CSS
      expect(result[0].pageContent).to.not.include(".mw-parser-output");
      expect(result[0].pageContent).to.not.include("font-style:italic");
      expect(result[0].pageContent).to.not.include("@media print");
    });
  });
});
