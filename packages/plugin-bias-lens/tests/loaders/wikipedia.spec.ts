import { describe, it } from "mocha";
import { expect } from "chai";
import { WikipediaLoader } from "../../src/loaders/wikipedia.js";

describe("WikipediaLoader", () => {
  const loader = new WikipediaLoader();

  describe("query", () => {
    it("should return results for a valid query", async function () {
      const result = await loader.query("Global warming potential");

      expect(result).to.be.an("array");
      expect(result.length).to.equal(1);
      expect(result[0]).to.have.property("pageContent");
      expect(result[0]).to.have.property("id");
      expect(result[0]).to.have.property("metadata");
    });

    it("should include a valid UUID as document id", async function () {
      this.timeout(10000);
      const result = await loader.query("Climate change");

      expect(result[0].id).to.be.a("string");
      // UUID v4 format validation
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result[0].id).to.match(uuidRegex);
    });

    it("should include source URL in metadata", async function () {
      const query = "Global warming potential";
      const result = await loader.query(query);

      expect(result[0].metadata).to.have.property("source");
      expect(result[0].metadata.source).to.be.a("string");
      expect(result[0].metadata.source).to.include("wikipedia.org");
      expect(result[0].metadata.source).to.include("search=");
    });

    it("should return non-empty page content", async function () {
      const result = await loader.query("Global warming potential");

      expect(result[0].pageContent).to.be.a("string");
      expect(result[0].pageContent.length).to.be.greaterThan(0);
    });

    it("should generate unique IDs for different queries", async function () {
      this.timeout(10000);
      const result1 = await loader.query("Climate");
      const result2 = await loader.query("Weather");

      expect(result1[0].id).to.not.equal(result2[0].id);
    });
  });
});
