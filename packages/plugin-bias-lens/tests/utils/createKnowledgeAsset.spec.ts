import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";
import {
  createKnowledgeAsset,
  setUAL,
} from "../../src/utils/createKnowledgeAsset.js";
import { clearPriceCache } from "../../src/utils/priceManager.js";
import type { LLMResponse } from "../../src/agents/bias-detector/llm-schema.js";
import type { SourceVersions } from "../../src/agents/bias-detector/schema.js";
import type { SimilarityResult } from "../../src/utils/similarity.js";

describe("createKnowledgeAsset Utility", () => {
  let sandbox: sinon.SinonSandbox;

  const createMockLLMResponse = (overrides?: Partial<LLMResponse>): LLMResponse => ({
    summary: {
      overview: "Test overview of bias analysis findings.",
      biasLevel: "moderate",
      keyPatterns: ["Pattern 1", "Pattern 2"],
      negativeNotesDescription: "1 factual error, 0 missing context issues",
    },
    claimReviews: [
      {
        claimReviewed: "Test verbatim claim from article",
        reviewBody: "Detailed explanation of the issue with evidence",
        reviewRating: {
          ratingValue: 4,
          ratingExplanation: "Good confidence - authoritative sources confirm finding",
        },
        itemReviewed: {
          text: "Test verbatim claim from article",
        },
        articleSection: "Introduction",
        reviewAspect: "factualError",
        citation: [
          {
            type: "ScholarlyArticle",
            name: "Test Source",
            url: "https://example.com/source",
            author: "Test Author",
            abstract: "Test abstract",
            citationCount: 100,
          },
        ],
      },
    ],
    similarity: {
      overallAlignment: 0.65,
      semanticSimilarity: 0.72,
      structuralSimilarity: 0.58,
      interpretation: "Some divergence detected between the articles.",
    },
    ...overrides,
  });

  const createMockSimilarity = (): SimilarityResult => ({
    cosineSimilarity: 0.72,
    lengthRatio: 1.2,
  });

  const createMockSourceVersions = (): SourceVersions => ({
    grokipedia: {
      url: "https://grokipedia.com/wiki/Test",
      accessedAt: "2024-01-15T10:00:00Z",
      pageHash: "sha256:abc123",
    },
    wikipedia: {
      url: "https://en.wikipedia.org/wiki/Test",
      accessedAt: "2024-01-15T10:00:00Z",
      revisionId: "12345",
      pageHash: "sha256:def456",
    },
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    clearPriceCache();
    sandbox.stub(global, "fetch").resolves({
      ok: true,
      json: async () => ({ origintrail: { usd: 0.5 } }),
    } as Response);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("createKnowledgeAsset", () => {
    it("should return public and private parts", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result).to.have.property("public");
      expect(result).to.have.property("private");
    });

    it("should set correct @context in both parts", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public["@context"]).to.equal("https://schema.org/");
      expect(result.private["@context"]).to.equal("https://schema.org/");
    });

    it("should set @type to ClaimReview in public part", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public["@type"]).to.equal("ClaimReview");
    });

    it("should set @id with UUID format", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public["@id"]).to.match(/^urn:dkg:bias-report:[0-9a-f-]{36}$/);
      expect(result.private["@id"]).to.equal(result.public["@id"]);
    });

    it("should map itemReviewed correctly", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public.itemReviewed["@type"]).to.equal("Article");
      expect(result.public.itemReviewed.url).to.equal("https://grokipedia.com/wiki/Test");
      expect(result.public.itemReviewed.name).to.equal("Test Article");
    });

    it("should map isBasedOn to Wikipedia URL with revision", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public.isBasedOn["@type"]).to.equal("Article");
      expect(result.public.isBasedOn.url).to.equal("https://en.wikipedia.org/wiki/Test");
      expect(result.public.isBasedOn.identifier).to.equal("revision:12345");
    });

    it("should map biasLevel to reviewRating", async () => {
      const llmResponse = createMockLLMResponse({
        summary: {
          overview: "Test",
          biasLevel: "high",
          keyPatterns: [],
          negativeNotesDescription: "2 factual errors",
        },
      });
      const result = await createKnowledgeAsset({
        llmResponse,
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public.reviewRating["@type"]).to.equal("Rating");
      expect(result.public.reviewRating.ratingValue).to.equal(2);
      expect(result.public.reviewRating.bestRating).to.equal(5);
      expect(result.public.reviewRating.worstRating).to.equal(1);
    });

    it("should map overview to reviewBody", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public.reviewBody).to.equal("Test overview of bias analysis findings.");
    });

    it("should map keyPatterns to keywords", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public.keywords).to.deep.equal(["Pattern 1", "Pattern 2"]);
    });

    it("should map negativeNotesDescription directly", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public.negativeNotes["@type"]).to.equal("ItemList");
      expect(result.public.negativeNotes.numberOfItems).to.equal(1);
      expect(result.public.negativeNotes.description).to.equal(
        "1 factual error, 0 missing context issues"
      );
    });

    it("should include publisher and creator", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public.publisher["@type"]).to.equal("Organization");
      expect(result.public.publisher.name).to.be.a("string");
      expect(result.public.creator["@type"]).to.equal("SoftwareApplication");
    });

    it("should include datePublished in ISO format", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public.datePublished).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it("should include license", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.public.license).to.equal("https://creativecommons.org/licenses/by-nc/4.0/");
    });

    it("should include offers with TRAC pricing", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
        metrics: { tokenUsage: 1000, costUSD: 0.1 },
      });

      expect(result.public.offers["@type"]).to.equal("Offer");
      expect(result.public.offers.priceCurrency).to.equal("TRAC");
      expect(result.public.offers.price).to.be.a("number");
      expect(result.public.offers.url).to.include("/purchase");
    });

    it("should include similarity review in private part", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.private.review["@type"]).to.equal("Review");
      expect(result.private.review.reviewAspect).to.equal("contentSimilarity");
      expect(result.private.review.reviewBody).to.equal(
        "Some divergence detected between the articles."
      );
    });

    it("should include three contentRating items for similarity metrics", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.private.review.contentRating).to.have.length(3);

      const explanations = result.private.review.contentRating.map(
        (r) => r.ratingExplanation
      );
      expect(explanations).to.include("semanticSimilarity");
      expect(explanations).to.include("structuralSimilarity");
      expect(explanations).to.include.members([
        expect.stringContaining ? "lengthRatio" : "lengthRatio (100 = same length, >100 = Grokipedia longer)",
      ]);
    });

    it("should convert claimReviews to hasPart in private", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.private.hasPart).to.be.an("array");
      expect(result.private.hasPart.length).to.equal(1);

      const claimReview = result.private.hasPart[0];
      expect(claimReview["@type"]).to.equal("ClaimReview");
      expect(claimReview.claimReviewed).to.equal("Test verbatim claim from article");
      expect(claimReview.reviewBody).to.equal(
        "Detailed explanation of the issue with evidence"
      );
      expect(claimReview.reviewAspect).to.equal("factualError");
    });

    it("should include citations in private ClaimReviews", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      const claimReview = result.private.hasPart[0];
      expect(claimReview.citation).to.be.an("array");
      expect(claimReview.citation.length).to.equal(1);

      const citation = claimReview.citation[0];
      expect(citation["@type"]).to.equal("ScholarlyArticle");
      expect(citation.name).to.equal("Test Source");
      expect(citation.author).to.equal("Test Author");
      expect(citation.citation).to.equal(100);
    });

    it("should include isPartOf with articleSection", async () => {
      const result = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      const claimReview = result.private.hasPart[0];
      expect(claimReview.isPartOf["@type"]).to.equal("Article");
      expect(claimReview.isPartOf.articleSection).to.equal("Introduction");
    });

    it("should handle multiple claimReviews", async () => {
      const llmResponse = createMockLLMResponse({
        claimReviews: [
          {
            claimReviewed: "Claim 1",
            reviewBody: "Issue 1",
            reviewRating: { ratingValue: 4, ratingExplanation: "High confidence" },
            itemReviewed: { text: "Claim 1" },
            articleSection: "Section 1",
            reviewAspect: "factualError",
            citation: [{ type: "WebPage", name: "Source 1", url: "https://example.com/1" }],
          },
          {
            claimReviewed: "Claim 2",
            reviewBody: "Issue 2",
            reviewRating: { ratingValue: 3, ratingExplanation: "Moderate confidence" },
            itemReviewed: { text: "Claim 2" },
            articleSection: "Section 2",
            reviewAspect: "missingContext",
            citation: [{ type: "WebPage", name: "Source 2", url: "https://example.com/2" }],
          },
        ],
      });

      const result = await createKnowledgeAsset({
        llmResponse,
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });

      expect(result.private.hasPart.length).to.equal(2);
      expect(result.private.hasPart[0].reviewAspect).to.equal("factualError");
      expect(result.private.hasPart[1].reviewAspect).to.equal("missingContext");
    });

    it("should map all bias levels correctly", async () => {
      const biasLevelToRating: Record<string, number> = {
        none: 5,
        low: 4,
        moderate: 3,
        high: 2,
        severe: 1,
      };

      for (const [biasLevel, expectedRating] of Object.entries(biasLevelToRating)) {
        const llmResponse = createMockLLMResponse({
          summary: {
            overview: "Test",
            biasLevel: biasLevel as "none" | "low" | "moderate" | "high" | "severe",
            keyPatterns: [],
            negativeNotesDescription: "test",
          },
        });

        const result = await createKnowledgeAsset({
          llmResponse,
          similarity: createMockSimilarity(),
          sourceVersions: createMockSourceVersions(),
          grokipediaUrl: "https://grokipedia.com/wiki/Test",
          wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
          articleTitle: "Test Article",
        });

        expect(result.public.reviewRating.ratingValue).to.equal(expectedRating);
      }
    });
  });

  describe("setUAL", () => {
    it("should set @id on both public and private parts", async () => {
      const asset = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });
      const ual = "did:dkg:otp:20430/paranet/asset-123";

      const result = setUAL(asset, ual);

      expect(result.public["@id"]).to.equal(ual);
      expect(result.private["@id"]).to.equal(ual);
    });

    it("should not modify the original asset", async () => {
      const asset = await createKnowledgeAsset({
        llmResponse: createMockLLMResponse(),
        similarity: createMockSimilarity(),
        sourceVersions: createMockSourceVersions(),
        grokipediaUrl: "https://grokipedia.com/wiki/Test",
        wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
        articleTitle: "Test Article",
      });
      const originalId = asset.public["@id"];
      const ual = "did:dkg:otp:20430/paranet/asset-456";

      setUAL(asset, ual);

      expect(asset.public["@id"]).to.equal(originalId);
    });
  });
});
