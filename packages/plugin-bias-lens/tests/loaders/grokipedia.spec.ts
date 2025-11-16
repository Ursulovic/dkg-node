import { describe, it } from "mocha";
import { expect } from "chai";
import { GrokipediaLoader } from "../../src/loaders/grokipedia.js";

describe("GrokipediaLoader", () => {
  const loader = new GrokipediaLoader();

  describe("loadPage", () => {
    it("should load a real page from grokipedia.com", async function () {
      const url = "https://grokipedia.com/page/Global_warming_potential";
      const result = await loader.loadPage(url);

      expect(result).to.be.an("array");
      expect(result.length).to.be.greaterThan(0);
      expect(result[0]).to.have.property("pageContent");
      expect(result[0].pageContent).to.be.a("string");
      expect(result[0].pageContent.length).to.be.greaterThan(0);
      expect(result[0].id).to.be.a("string");
    });

    it("should throw error for invalid URL format", async () => {
      const url = "not-a-valid-url";

      try {
        await loader.loadPage(url);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal(
          `Invalid Grokipedia URL: ${url}`,
        );
      }
    });

    it("should throw error for different domain", async () => {
      const url = "https://example.com/article/test";

      try {
        await loader.loadPage(url);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal(
          `Invalid Grokipedia URL: ${url}`,
        );
      }
    });
  });
});
