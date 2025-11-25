import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";
import { OpenAIEmbeddings } from "@langchain/openai";
import {
  calculateArticleSimilarity,
  cosineSimilarity,
} from "../../src/utils/similarity.js";

describe("Similarity Utility", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("cosineSimilarity", () => {
    it("should return 1 for identical vectors", () => {
      const vec = [1, 2, 3, 4, 5];
      const similarity = cosineSimilarity(vec, vec);
      expect(similarity).to.be.closeTo(1, 0.0001);
    });

    it("should return 0 for orthogonal vectors", () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).to.be.closeTo(0, 0.0001);
    });

    it("should return -1 for opposite vectors", () => {
      const vec1 = [1, 2, 3];
      const vec2 = [-1, -2, -3];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).to.be.closeTo(-1, 0.0001);
    });

    it("should handle normalized vectors", () => {
      const vec1 = [0.6, 0.8, 0];
      const vec2 = [0.6, 0.8, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).to.be.closeTo(1, 0.0001);
    });

    it("should return 0 when one vector is zero", () => {
      const vec1 = [1, 2, 3];
      const vec2 = [0, 0, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).to.equal(0);
    });

    it("should return 0 when both vectors are zero", () => {
      const vec1 = [0, 0, 0];
      const vec2 = [0, 0, 0];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).to.equal(0);
    });

    it("should handle high-dimensional vectors", () => {
      const dim = 1024;
      const vec1 = Array(dim).fill(1);
      const vec2 = Array(dim).fill(1);
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).to.be.closeTo(1, 0.0001);
    });

    it("should calculate similarity between similar but not identical vectors", () => {
      const vec1 = [1, 2, 3, 4, 5];
      const vec2 = [1.1, 2.1, 3.1, 4.1, 5.1];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).to.be.greaterThan(0.99);
      expect(similarity).to.be.lessThan(1);
    });

    it("should handle vectors with different magnitudes but same direction", () => {
      const vec1 = [1, 2, 3];
      const vec2 = [2, 4, 6];
      const similarity = cosineSimilarity(vec1, vec2);
      expect(similarity).to.be.closeTo(1, 0.0001);
    });
  });

  describe("calculateArticleSimilarity", () => {
    it("should calculate similarity and length metrics", async () => {
      const grokipediaContent = "This is the Grokipedia article content about climate change.";
      const wikipediaContent = "This is the Wikipedia article content about climate change.";

      const mockEmbedding1 = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockEmbedding2 = [0.15, 0.25, 0.35, 0.45, 0.55];

      sandbox
        .stub(OpenAIEmbeddings.prototype, "embedQuery")
        .onFirstCall()
        .resolves(mockEmbedding1)
        .onSecondCall()
        .resolves(mockEmbedding2);

      const result = await calculateArticleSimilarity(
        grokipediaContent,
        wikipediaContent
      );

      expect(result).to.have.property("cosineSimilarity");
      expect(result).to.have.property("grokipediaLength");
      expect(result).to.have.property("wikipediaLength");
      expect(result).to.have.property("lengthRatio");

      expect(result.cosineSimilarity).to.be.a("number");
      expect(result.cosineSimilarity).to.be.greaterThan(0);
      expect(result.cosineSimilarity).to.be.lessThanOrEqual(1);

      expect(result.grokipediaLength).to.equal(grokipediaContent.length);
      expect(result.wikipediaLength).to.equal(wikipediaContent.length);
      expect(result.lengthRatio).to.be.closeTo(
        grokipediaContent.length / wikipediaContent.length,
        0.0001
      );
    });

    it("should return ~1 similarity for identical content", async () => {
      const content = "This is identical content.";

      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      sandbox
        .stub(OpenAIEmbeddings.prototype, "embedQuery")
        .resolves(mockEmbedding);

      const result = await calculateArticleSimilarity(content, content);

      expect(result.cosineSimilarity).to.be.closeTo(1, 0.0001);
      expect(result.lengthRatio).to.equal(1);
    });

    it("should return lower similarity for different content", async () => {
      const grokipediaContent = "Article about cats and their behavior.";
      const wikipediaContent = "Quantum physics and particle dynamics.";

      const mockEmbedding1 = [0.9, 0.1, 0.0, 0.0, 0.0];
      const mockEmbedding2 = [0.0, 0.0, 0.0, 0.1, 0.9];

      sandbox
        .stub(OpenAIEmbeddings.prototype, "embedQuery")
        .onFirstCall()
        .resolves(mockEmbedding1)
        .onSecondCall()
        .resolves(mockEmbedding2);

      const result = await calculateArticleSimilarity(
        grokipediaContent,
        wikipediaContent
      );

      expect(result.cosineSimilarity).to.be.lessThan(0.5);
    });

    it("should handle empty strings gracefully", async () => {
      const emptyContent = "";
      const content = "Some content here.";

      const mockEmbedding1 = [0, 0, 0, 0, 0];
      const mockEmbedding2 = [0.1, 0.2, 0.3, 0.4, 0.5];

      sandbox
        .stub(OpenAIEmbeddings.prototype, "embedQuery")
        .onFirstCall()
        .resolves(mockEmbedding1)
        .onSecondCall()
        .resolves(mockEmbedding2);

      const result = await calculateArticleSimilarity(emptyContent, content);

      expect(result.cosineSimilarity).to.equal(0);
      expect(result.grokipediaLength).to.equal(0);
      expect(result.lengthRatio).to.equal(0);
    });

    it("should calculate correct length ratio", async () => {
      const grokipediaContent = "Short content.";
      const wikipediaContent = "This is much longer content that spans multiple sentences.";

      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      sandbox
        .stub(OpenAIEmbeddings.prototype, "embedQuery")
        .resolves(mockEmbedding);

      const result = await calculateArticleSimilarity(
        grokipediaContent,
        wikipediaContent
      );

      const expectedRatio =
        grokipediaContent.length / wikipediaContent.length;
      expect(result.lengthRatio).to.be.closeTo(expectedRatio, 0.0001);
    });

    it("should handle zero-length Wikipedia content", async () => {
      const grokipediaContent = "Some content.";
      const wikipediaContent = "";

      const mockEmbedding1 = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockEmbedding2 = [0, 0, 0, 0, 0];

      sandbox
        .stub(OpenAIEmbeddings.prototype, "embedQuery")
        .onFirstCall()
        .resolves(mockEmbedding1)
        .onSecondCall()
        .resolves(mockEmbedding2);

      const result = await calculateArticleSimilarity(
        grokipediaContent,
        wikipediaContent
      );

      expect(result.lengthRatio).to.equal(0);
    });

    it("should embed both articles in parallel", async () => {
      const grokipediaContent = "Grokipedia article.";
      const wikipediaContent = "Wikipedia article.";

      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      const embedStub = sandbox
        .stub(OpenAIEmbeddings.prototype, "embedQuery")
        .resolves(mockEmbedding);

      await calculateArticleSimilarity(grokipediaContent, wikipediaContent);

      expect(embedStub.callCount).to.equal(2);
      expect(embedStub.firstCall.args[0]).to.equal(grokipediaContent);
      expect(embedStub.secondCall.args[0]).to.equal(wikipediaContent);
    });
  });
});
