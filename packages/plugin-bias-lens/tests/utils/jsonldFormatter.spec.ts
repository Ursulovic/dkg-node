import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";
import {
  formatAsJsonLd,
  setUAL,
} from "../../src/utils/jsonldFormatter.js";
import { clearPriceCache } from "../../src/utils/priceManager.js";
import type { BiasDetectionReport } from "../../src/agents/bias-detector/schema.js";

describe("JSON-LD Formatter Utility", () => {
  let sandbox: sinon.SinonSandbox;

  const createMockReport = (overrides?: Partial<BiasDetectionReport>): BiasDetectionReport => ({
    "@context": {
      "@vocab": "https://schema.org/",
      prov: "http://www.w3.org/ns/prov#",
    },
    "@type": "BiasDetectionReport",
    articleTitle: "Test Article",
    grokipediaUrl: "https://grokipedia.com/wiki/Test",
    wikipediaUrl: "https://en.wikipedia.org/wiki/Test",
    analysisDate: "2024-01-15T10:00:00Z",
    executiveSummary: {
      overview: "Test overview of bias analysis findings.",
      biasLevel: "moderate",
      keyPatterns: ["Pattern 1", "Pattern 2"],
    },
    factualErrors: [
      {
        claim: "Test claim",
        issue: "Test issue",
        confidence: 0.85,
        sources: [
          {
            name: "Test Source",
            url: "https://example.com/source",
            credibilityTier: "peer-reviewed",
            authors: "Test Author",
            snippet: "Test snippet",
            totalCitations: 100,
          },
        ],
        toolsUsed: ["google_scholar_search"],
        section: "Introduction",
      },
    ],
    missingContext: [],
    sourceProblems: [],
    mediaIssues: [],
    overallAssessment: {
      overallBiasConfidence: 0.75,
      totalFactualErrors: 1,
      totalMissingContext: 0,
      totalSourceProblems: 0,
      totalMediaIssues: 0,
    },
    contentSimilarity: {
      overallAlignment: 0.65,
      alignmentDescription: "Moderate alignment",
      textSimilarity: {
        semanticSimilarity: 0.72,
        structuralSimilarity: 0.58,
        lengthRatio: 1.2,
      },
      interpretation: "Some divergence detected.",
    },
    provenance: {
      creator: "Test Agent",
      verificationMethod: "Test method",
      toolsUsed: ["google_scholar_search", "web_search"],
      sourceVersions: {
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
      },
    },
    ...overrides,
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

  describe("formatAsJsonLd", () => {
    it("should return public and private parts", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result).to.have.property("public");
      expect(result).to.have.property("private");
    });

    it("should set correct @context in public part (without x402)", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.public["@context"]["@vocab"]).to.equal("https://schema.org/");
      expect(result.public["@context"].prov).to.equal("http://www.w3.org/ns/prov#");
      expect(result.public["@context"]).to.not.have.property("x402");
    });

    it("should set @type to Review in public part", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.public["@type"]).to.equal("Review");
    });

    it("should set @id to null initially", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.public["@id"]).to.be.null;
      expect(result.private["@id"]).to.be.null;
    });

    it("should map itemReviewed correctly", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.public.itemReviewed["@type"]).to.equal("Article");
      expect(result.public.itemReviewed.url).to.equal(report.grokipediaUrl);
      expect(result.public.itemReviewed.name).to.equal(report.articleTitle);
    });

    it("should map isBasedOn to Wikipedia URL", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.public.isBasedOn["@type"]).to.equal("Article");
      expect(result.public.isBasedOn.url).to.equal(report.wikipediaUrl);
    });

    it("should map biasLevel to reviewRating", async () => {
      const report = createMockReport({
        executiveSummary: {
          overview: "Test",
          biasLevel: "high",
          keyPatterns: []
        }
      });
      const result = await formatAsJsonLd(report);

      expect(result.public.reviewRating["@type"]).to.equal("Rating");
      expect(result.public.reviewRating.ratingValue).to.equal(2);
      expect(result.public.reviewRating.bestRating).to.equal(5);
      expect(result.public.reviewRating.worstRating).to.equal(1);
    });

    it("should map overview to reviewBody", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.public.reviewBody).to.equal(report.executiveSummary.overview);
    });

    it("should map keyPatterns to keywords", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.public.keywords).to.deep.equal(report.executiveSummary.keyPatterns);
    });

    it("should calculate negativeNotes correctly", async () => {
      const report = createMockReport({
        overallAssessment: {
          overallBiasConfidence: 0.8,
          totalFactualErrors: 3,
          totalMissingContext: 2,
          totalSourceProblems: 1,
          totalMediaIssues: 0,
        },
      });
      const result = await formatAsJsonLd(report);

      expect(result.public.negativeNotes["@type"]).to.equal("ItemList");
      expect(result.public.negativeNotes.numberOfItems).to.equal(6);
      expect(result.public.negativeNotes.description).to.include("3 factual error");
      expect(result.public.negativeNotes.description).to.include("2 missing context");
      expect(result.public.negativeNotes.description).to.include("1 source problem");
    });

    it("should include all additionalProperty metrics", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      const propIds = result.public.additionalProperty.map((p) => p.propertyID);

      expect(propIds).to.include("semanticSimilarity");
      expect(propIds).to.include("structuralSimilarity");
      expect(propIds).to.include("lengthRatio");
      expect(propIds).to.include("overallAlignment");
      expect(propIds).to.include("totalFactualErrors");
      expect(propIds).to.include("totalMissingContext");
      expect(propIds).to.include("overallBiasConfidence");
      expect(propIds).to.include("privateContentAvailable");
      expect(propIds).to.include("privateAccessFee");
    });

    it("should include payment metadata in additionalProperty", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      const propIds = result.public.additionalProperty.map((p) => p.propertyID);

      expect(propIds).to.include("tokenUsage");
      expect(propIds).to.include("costUSD");
      expect(propIds).to.include("costTRAC");
      expect(propIds).to.include("readCostMultiplier");
      expect(propIds).to.include("calculatedReadCost");
    });

    it("should include prov:wasGeneratedBy", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.public["prov:wasGeneratedBy"]["@type"]).to.equal("prov:Activity");
      expect(result.public["prov:wasGeneratedBy"]["prov:wasAssociatedWith"]["@type"]).to.equal(
        "SoftwareApplication"
      );
      expect(result.public["prov:wasGeneratedBy"]["prov:used"]).to.be.an("array");
    });

    it("should include prov:used with source versions", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.public["prov:used"]).to.be.an("array");
      expect(result.public["prov:used"].length).to.equal(2);

      const grokEntity = result.public["prov:used"].find(
        (e) => e["@id"] === report.grokipediaUrl
      );
      expect(grokEntity).to.exist;
      expect(grokEntity?.["@type"]).to.equal("prov:Entity");
      expect(grokEntity?.identifier).to.equal("sha256:abc123");
    });

    it("should set privateContentAvailable based on issues count", async () => {
      const reportWithIssues = createMockReport();
      const resultWithIssues = await formatAsJsonLd(reportWithIssues);
      const privateAvailable = resultWithIssues.public.additionalProperty.find(
        (p) => p.propertyID === "privateContentAvailable"
      );
      expect(privateAvailable?.value).to.be.true;

      const reportNoIssues = createMockReport({
        factualErrors: [],
        overallAssessment: {
          overallBiasConfidence: 0,
          totalFactualErrors: 0,
          totalMissingContext: 0,
          totalSourceProblems: 0,
          totalMediaIssues: 0,
        },
      });
      const resultNoIssues = await formatAsJsonLd(reportNoIssues);
      const privateAvailableNo = resultNoIssues.public.additionalProperty.find(
        (p) => p.propertyID === "privateContentAvailable"
      );
      expect(privateAvailableNo?.value).to.be.false;
    });

    it("should convert factualErrors to ClaimReviews in private part", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.private.hasPart).to.be.an("array");
      expect(result.private.hasPart.length).to.equal(1);

      const claimReview = result.private.hasPart[0];
      expect(claimReview["@type"]).to.equal("ClaimReview");
      expect(claimReview.claimReviewed).to.equal("Test claim");
      expect(claimReview.reviewBody).to.equal("Test issue");
      expect(claimReview.reviewAspect).to.equal("factualError");
    });

    it("should include citations in private ClaimReviews", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      const claimReview = result.private.hasPart[0];
      expect(claimReview.citation).to.be.an("array");
      expect(claimReview.citation.length).to.equal(1);

      const citation = claimReview.citation[0];
      expect(citation["@type"]).to.equal("ScholarlyArticle");
      expect(citation.name).to.equal("Test Source");
      expect(citation.author).to.equal("Test Author");
      expect(citation.citation).to.equal(100);
    });

    it("should include prov:wasGeneratedBy with toolsUsed in private ClaimReviews", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      const claimReview = result.private.hasPart[0];
      expect(claimReview["prov:wasGeneratedBy"]["@type"]).to.equal("prov:Activity");
      expect(claimReview["prov:wasGeneratedBy"]["prov:used"]).to.deep.equal([
        "google_scholar_search",
      ]);
    });

    it("should handle reports with multiple issue types", async () => {
      const report = createMockReport({
        factualErrors: [
          {
            claim: "Claim 1",
            issue: "Issue 1",
            confidence: 0.9,
            sources: [
              {
                name: "Source 1",
                url: "https://example.com/1",
                credibilityTier: "peer-reviewed",
                authors: null,
                snippet: null,
                totalCitations: null,
              },
            ],
            toolsUsed: ["google_scholar_search"],
            section: "Section 1",
          },
        ],
        missingContext: [
          {
            claim: "Claim 2",
            issue: "Issue 2",
            confidence: 0.8,
            sources: [
              {
                name: "Source 2",
                url: "https://example.com/2",
                credibilityTier: "government",
                authors: null,
                snippet: null,
                totalCitations: null,
              },
            ],
            toolsUsed: ["web_search"],
            section: "Section 2",
          },
        ],
        overallAssessment: {
          overallBiasConfidence: 0.85,
          totalFactualErrors: 1,
          totalMissingContext: 1,
          totalSourceProblems: 0,
          totalMediaIssues: 0,
        },
      });
      const result = await formatAsJsonLd(report);

      expect(result.private.hasPart.length).to.equal(2);
      expect(result.private.hasPart[0].reviewAspect).to.equal("factualError");
      expect(result.private.hasPart[1].reviewAspect).to.equal("missingContext");
    });

    it("should include publisher with additionalProperty for payment info", async () => {
      const report = createMockReport();
      const result = await formatAsJsonLd(report);

      expect(result.public.publisher["@type"]).to.equal("Organization");
      expect(result.public.publisher.name).to.be.a("string");
      expect(result.public.publisher.additionalProperty).to.be.an("array");

      const walletProp = result.public.publisher.additionalProperty?.find(
        (p) => p.propertyID === "walletAddress"
      );
      expect(walletProp).to.exist;

      const networkProp = result.public.publisher.additionalProperty?.find(
        (p) => p.propertyID === "paymentNetwork"
      );
      expect(networkProp?.value).to.equal("otp:20430");

      const tokenProp = result.public.publisher.additionalProperty?.find(
        (p) => p.propertyID === "paymentToken"
      );
      expect(tokenProp?.value).to.equal("TRAC");
    });
  });

  describe("setUAL", () => {
    it("should set @id on both public and private parts", async () => {
      const report = createMockReport();
      const asset = await formatAsJsonLd(report);
      const ual = "did:dkg:otp:20430/paranet/asset-123";

      const result = setUAL(asset, ual);

      expect(result.public["@id"]).to.equal(ual);
      expect(result.private["@id"]).to.equal(ual);
    });

    it("should not modify the original asset", async () => {
      const report = createMockReport();
      const asset = await formatAsJsonLd(report);
      const ual = "did:dkg:otp:20430/paranet/asset-456";

      setUAL(asset, ual);

      expect(asset.public["@id"]).to.be.null;
      expect(asset.private["@id"]).to.be.null;
    });
  });
});
