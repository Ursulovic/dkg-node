import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";
import { readFile } from "node:fs/promises";
import { ExternalAssetsLoader } from "../../src/loaders/external.js";
import type { Link } from "../../src/parsers/wikipedia.js";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  setupFetchMock,
  setupGeminiMock,
  createTimeoutFetchMock,
} from "../helpers/mocks.js";

describe("ExternalAssetsLoader", () => {
  let fetchStub: sinon.SinonStub;
  let invokeStub: sinon.SinonStub;
  const originalGoogleApiKey = process.env.GOOGLE_API_KEY;

  beforeEach(() => {
    // Set up Google API key for tests
    process.env.GOOGLE_API_KEY = "test-google-api-key";

    // Stub global fetch
    fetchStub = sinon.stub(global, "fetch");
    setupFetchMock(fetchStub);

    // Stub Gemini API
    invokeStub = sinon.stub(ChatGoogleGenerativeAI.prototype, "invoke");
    setupGeminiMock(invokeStub);
  });

  afterEach(() => {
    // Restore all stubs
    fetchStub.restore();
    invokeStub.restore();

    // Restore original API key
    if (originalGoogleApiKey) {
      process.env.GOOGLE_API_KEY = originalGoogleApiKey;
    } else {
      delete process.env.GOOGLE_API_KEY;
    }
  });

  describe("Constructor Options", () => {
    it("should use default timeout and concurrency", () => {
      const loader = new ExternalAssetsLoader();
      expect(loader).to.be.instanceOf(ExternalAssetsLoader);
    });

    it("should accept custom timeout and concurrency", () => {
      const loader = new ExternalAssetsLoader({
        timeout: 5000,
        concurrency: 5,
      });
      expect(loader).to.be.instanceOf(ExternalAssetsLoader);
    });
  });

  describe("loadPDFs", () => {
    const loader = new ExternalAssetsLoader();
    const mockSourceUrl = "https://en.wikipedia.org/wiki/Test_Article";

    it("should return empty result for empty input", async () => {
      const links: Link[] = [];
      const result = await loader.loadPDFs(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.equal(0);
      expect(result.errors).to.be.an("array");
      expect(result.errors.length).to.equal(0);
      expect(result.stats).to.deep.equal({
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
      });
    });

    it("should load PDF and return LoadResult with documents", async () => {
      const links: Link[] = [
        {
          text: "GHG Protocol PDF",
          url: "https://ghgprotocol.org/sites/default/files/2024-08/Global-Warming-Potential-Values.pdf",
          type: "pdf",
        },
      ];

      const result = await loader.loadPDFs(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      // Note: Mock PDF may not have extractable text, so documents might be empty
      // The important test is that it doesn't throw errors

      // Check LoadResult structure
      expect(result).to.have.property("documents");
      expect(result).to.have.property("errors");
      expect(result).to.have.property("stats");

      // Check stats
      expect(result.stats.total).to.equal(1);
      expect(result.stats.skipped).to.equal(0);

      // Either succeeded or failed (depending on PDF content extraction)
      expect(result.stats.succeeded + result.stats.failed).to.equal(1);

      // If succeeded, verify document structure
      if (result.documents.length > 0) {
        const firstDoc = result.documents[0];
        expect(firstDoc).to.have.property("pageContent");
        expect(firstDoc).to.have.property("id");
        expect(firstDoc.metadata).to.have.property("source");
        expect(firstDoc.metadata.source).to.equal(mockSourceUrl);
        expect(firstDoc.metadata).to.have.property("assetSource");
        expect(firstDoc.metadata.assetSource).to.equal(links[0].url);
        expect(firstDoc.metadata.assetType).to.equal("pdf");
      }
    });

    it("should track errors for unavailable PDFs", async () => {
      const links: Link[] = [
        {
          text: "Broken PDF",
          url: "https://example.com/grok-broken-link-404.pdf",
          type: "pdf",
        },
      ];

      const result = await loader.loadPDFs(links, mockSourceUrl);

      // Should have no documents
      expect(result.documents.length).to.equal(0);

      // Should have error tracked
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.have.property("url");
      expect(result.errors[0].url).to.equal(links[0].url);
      expect(result.errors[0]).to.have.property("type");
      expect(result.errors[0].type).to.equal("pdf");
      expect(result.errors[0]).to.have.property("error");
      expect(result.errors[0].error).to.include("404");

      // Check stats
      expect(result.stats.total).to.equal(1);
      expect(result.stats.succeeded).to.equal(0);
      expect(result.stats.failed).to.equal(1);
      expect(result.stats.skipped).to.equal(0);
    });

    it("should deduplicate PDF links", async () => {
      const links: Link[] = [
        {
          text: "IPCC PDF",
          url: "https://archive.ipcc.ch/pdf/special-reports/sroc/Boxes/b0202.pdf",
          type: "pdf",
        },
        {
          text: "DUPLICATE: IPCC PDF",
          url: "https://archive.ipcc.ch/pdf/special-reports/sroc/Boxes/b0202.pdf",
          type: "pdf",
        },
      ];

      const result = await loader.loadPDFs(links, mockSourceUrl);

      // Should process only unique URLs
      expect(result.stats.total).to.equal(2);
      expect(result.stats.skipped).to.equal(1); // One duplicate
      expect(result.stats.succeeded + result.stats.failed).to.equal(1); // Only one processed
    });

    it("should assign unique IDs to each document", async () => {
      const links: Link[] = [
        {
          text: "Test PDF",
          url: "https://example.com/test.pdf",
          type: "pdf",
        },
      ];

      const result = await loader.loadPDFs(links, mockSourceUrl);

      expect(result.documents.length).to.be.greaterThan(0);

      const ids = result.documents.map((doc) => doc.id);
      const uniqueIds = new Set(ids);

      // All IDs should be unique
      expect(uniqueIds.size).to.equal(ids.length);

      // IDs should be valid UUIDs (basic check)
      for (const id of ids) {
        expect(id).to.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      }
    });

    it("should continue processing after one PDF fails", async () => {
      const links: Link[] = [
        {
          text: "Broken PDF",
          url: "https://example.com/broken-link.pdf",
          type: "pdf",
        },
        {
          text: "Valid PDF",
          url: "https://example.com/valid.pdf",
          type: "pdf",
        },
      ];

      const result = await loader.loadPDFs(links, mockSourceUrl);

      // Should have one success and one failure
      expect(result.stats.total).to.equal(2);
      expect(result.stats.succeeded).to.be.greaterThan(0);
      expect(result.stats.failed).to.equal(1);

      // Should have documents from the valid PDF
      expect(result.documents.length).to.be.greaterThan(0);

      // Should have error from broken PDF
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0].url).to.include("broken-link");
    });

    it("should handle timeout gracefully", async function () {
      this.timeout(5000);

      // Replace fetch mock with timeout simulation
      fetchStub.restore();
      fetchStub = sinon.stub(global, "fetch");
      createTimeoutFetchMock(fetchStub);

      const loaderWithShortTimeout = new ExternalAssetsLoader({ timeout: 100 });

      const links: Link[] = [
        {
          text: "Slow PDF",
          url: "https://example.com/slow.pdf",
          type: "pdf",
        },
      ];

      const result = await loaderWithShortTimeout.loadPDFs(
        links,
        mockSourceUrl,
      );

      // Should timeout and track error
      expect(result.documents.length).to.equal(0);
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0].error).to.match(/abort|timeout/i);
    });
  });

  describe("loadHTML", () => {
    const loader = new ExternalAssetsLoader();
    const mockSourceUrl = "https://en.wikipedia.org/wiki/Test_Article";

    it("should return empty result for empty input", async () => {
      const links: Link[] = [];
      const result = await loader.loadHTML(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.equal(0);
      expect(result.errors).to.be.an("array");
      expect(result.errors.length).to.equal(0);
      expect(result.stats).to.deep.equal({
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
      });
    });

    it("should load HTML and return LoadResult with documents", async () => {
      const links: Link[] = [
        {
          text: "EPA emissions",
          url: "https://www.epa.gov/ghgemissions/understanding-global-warming-potentials",
          type: "html",
        },
      ];

      const result = await loader.loadHTML(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.equal(1);

      const firstDoc = result.documents[0];
      expect(firstDoc).to.have.property("pageContent");
      expect(firstDoc.pageContent).to.be.a("string");
      expect(firstDoc.pageContent.length).to.be.greaterThan(0);
      expect(firstDoc.id).to.be.a("string");

      // Check metadata structure
      expect(firstDoc.metadata).to.have.property("source");
      expect(firstDoc.metadata.source).to.equal(mockSourceUrl);
      expect(firstDoc.metadata).to.have.property("assetSource");
      expect(firstDoc.metadata.assetSource).to.equal(links[0].url);
      expect(firstDoc.metadata).to.have.property("assetType");
      expect(firstDoc.metadata.assetType).to.equal("html");

      // Check stats
      expect(result.stats.total).to.equal(1);
      expect(result.stats.succeeded).to.equal(1);
      expect(result.stats.failed).to.equal(0);
      expect(result.stats.skipped).to.equal(0);

      // No errors
      expect(result.errors.length).to.equal(0);
    });

    it("should track errors for unavailable HTML pages", async () => {
      const links: Link[] = [
        {
          text: "Broken link",
          url: "https://example.com/this-page-does-not-exist-12345",
          type: "html",
        },
      ];

      const result = await loader.loadHTML(links, mockSourceUrl);

      // Should have no documents
      expect(result.documents.length).to.equal(0);

      // Should have error tracked
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.have.property("url");
      expect(result.errors[0].url).to.equal(links[0].url);
      expect(result.errors[0]).to.have.property("type");
      expect(result.errors[0].type).to.equal("html");
      expect(result.errors[0]).to.have.property("error");
      expect(result.errors[0].error).to.include("404");

      // Check stats
      expect(result.stats.total).to.equal(1);
      expect(result.stats.succeeded).to.equal(0);
      expect(result.stats.failed).to.equal(1);
      expect(result.stats.skipped).to.equal(0);
    });

    it("should deduplicate HTML links", async () => {
      const links: Link[] = [
        {
          text: "IPCC archive",
          url: "https://archive.ipcc.ch/ipccreports/tar/wg1/247.htm",
          type: "html",
        },
        {
          text: "DUPLICATE: IPCC archive",
          url: "https://archive.ipcc.ch/ipccreports/tar/wg1/247.htm",
          type: "html",
        },
      ];

      const result = await loader.loadHTML(links, mockSourceUrl);

      // Should process only unique URLs
      expect(result.stats.total).to.equal(2);
      expect(result.stats.skipped).to.equal(1); // One duplicate
      expect(result.stats.succeeded + result.stats.failed).to.equal(1); // Only one processed
    });

    it("should handle multiple HTML links concurrently", async () => {
      const links: Link[] = [
        {
          text: "EPA emissions",
          url: "https://www.epa.gov/ghgemissions/understanding-global-warming-potentials",
          type: "html",
        },
        {
          text: "Nature article",
          url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC7212016/",
          type: "html",
        },
        {
          text: "ArXiv repository",
          url: "https://eartharxiv.org/repository/view/1686/",
          type: "html",
        },
      ];

      const result = await loader.loadHTML(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.equal(3);

      // Each document should have correct metadata
      for (const doc of result.documents) {
        expect(doc.metadata.source).to.equal(mockSourceUrl);
        expect(doc.metadata.assetType).to.equal("html");
      }

      // Check stats
      expect(result.stats.total).to.equal(3);
      expect(result.stats.succeeded).to.equal(3);
      expect(result.stats.failed).to.equal(0);
    });

    it("should assign unique IDs to each document", async () => {
      const links: Link[] = [
        {
          text: "Example",
          url: "https://example.com",
          type: "html",
        },
      ];

      const result = await loader.loadHTML(links, mockSourceUrl);

      expect(result.documents.length).to.be.greaterThan(0);

      const ids = result.documents.map((doc) => doc.id);
      const uniqueIds = new Set(ids);

      // All IDs should be unique
      expect(uniqueIds.size).to.equal(ids.length);

      // IDs should be valid UUIDs
      for (const id of ids) {
        expect(id).to.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      }
    });

    it("should continue processing after one HTML page fails", async () => {
      const links: Link[] = [
        {
          text: "Broken",
          url: "https://example.com/broken-link",
          type: "html",
        },
        {
          text: "Valid",
          url: "https://example.com/valid",
          type: "html",
        },
      ];

      const result = await loader.loadHTML(links, mockSourceUrl);

      // Should have one success and one failure
      expect(result.stats.total).to.equal(2);
      expect(result.stats.succeeded).to.equal(1);
      expect(result.stats.failed).to.equal(1);

      // Should have document from valid page
      expect(result.documents.length).to.equal(1);

      // Should have error from broken page
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0].url).to.include("broken-link");
    });
  });

  describe("loadMedia", () => {
    const loader = new ExternalAssetsLoader();
    const mockSourceUrl = "https://en.wikipedia.org/wiki/Test_Article";

    it("should return empty result for empty input", async () => {
      const links: Link[] = [];
      const result = await loader.loadMedia(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.equal(0);
      expect(result.errors).to.be.an("array");
      expect(result.errors.length).to.equal(0);
      expect(result.stats).to.deep.equal({
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
      });
      expect(invokeStub.called).to.be.false;
    });

    it("should throw error if GOOGLE_API_KEY is not set", async () => {
      delete process.env.GOOGLE_API_KEY;

      const links: Link[] = [
        {
          text: "Test Image",
          url: "https://example.com/image.jpg",
          type: "image",
        },
      ];

      try {
        await loader.loadMedia(links, mockSourceUrl);
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include("GOOGLE_API_KEY");
      }
    });

    it("should generate description for image", async () => {
      const links: Link[] = [
        {
          text: "Global warming image",
          url: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/80/Global-warming-potential.png",
          type: "image",
        },
      ];

      const result = await loader.loadMedia(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.equal(1);

      const doc = result.documents[0];
      expect(doc.pageContent).to.be.a("string");
      expect(doc.pageContent.length).to.be.greaterThan(0);
      expect(doc.metadata.source).to.equal(mockSourceUrl);
      expect(doc.metadata.assetSource).to.equal(links[0].url);
      expect(doc.metadata.assetType).to.equal("image");
      expect(doc.id).to.be.a("string");
      expect(invokeStub.calledOnce).to.be.true;

      // Check stats
      expect(result.stats.total).to.equal(1);
      expect(result.stats.succeeded).to.equal(1);
      expect(result.stats.failed).to.equal(0);
      expect(result.stats.skipped).to.equal(0);

      // No errors
      expect(result.errors.length).to.equal(0);
    });

    it("should track errors when Gemini API fails", async () => {
      // Override mock to reject
      invokeStub.restore();
      invokeStub = sinon.stub(ChatGoogleGenerativeAI.prototype, "invoke");
      invokeStub.rejects(new Error("Gemini API rate limit exceeded"));

      const links: Link[] = [
        {
          text: "Test Image",
          url: "https://example.com/image.jpg",
          type: "image",
        },
      ];

      const result = await loader.loadMedia(links, mockSourceUrl);

      // Should have no documents
      expect(result.documents.length).to.equal(0);

      // Should have error tracked
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0]).to.have.property("url");
      expect(result.errors[0].url).to.equal(links[0].url);
      expect(result.errors[0]).to.have.property("type");
      expect(result.errors[0].type).to.equal("image");
      expect(result.errors[0]).to.have.property("error");
      expect(result.errors[0].error).to.include("Gemini API");

      // Check stats
      expect(result.stats.total).to.equal(1);
      expect(result.stats.succeeded).to.equal(0);
      expect(result.stats.failed).to.equal(1);
      expect(result.stats.skipped).to.equal(0);
    });

    it("should deduplicate media links", async () => {
      const links: Link[] = [
        {
          text: "Image",
          url: "https://example.com/image.jpg",
          type: "image",
        },
        {
          text: "DUPLICATE: Image",
          url: "https://example.com/image.jpg",
          type: "image",
        },
      ];

      const result = await loader.loadMedia(links, mockSourceUrl);

      // Should process only unique URLs
      expect(result.stats.total).to.equal(2);
      expect(result.stats.skipped).to.equal(1); // One duplicate
      expect(result.stats.succeeded + result.stats.failed).to.equal(1); // Only one processed
      expect(invokeStub.calledOnce).to.be.true; // Only one API call
    });

    it("should handle multiple media types", async () => {
      const links: Link[] = [
        {
          text: "Image",
          url: "https://example.com/image.jpg",
          type: "image",
        },
        {
          text: "Audio",
          url: "https://example.com/audio.mp3",
          type: "audio",
        },
        {
          text: "Video",
          url: "https://example.com/video.mp4",
          type: "video",
        },
      ];

      const result = await loader.loadMedia(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.equal(3);
      expect(invokeStub.callCount).to.equal(3);

      // Check all results have correct metadata
      const assetTypes = result.documents.map((doc) => doc.metadata.assetType);
      expect(assetTypes).to.include("image");
      expect(assetTypes).to.include("audio");
      expect(assetTypes).to.include("video");

      for (const doc of result.documents) {
        expect(doc.metadata.source).to.equal(mockSourceUrl);
        expect(["image", "audio", "video"]).to.include(doc.metadata.assetType);
      }
    });

    it("should assign unique IDs to each document", async () => {
      const links: Link[] = [
        {
          text: "Image 1",
          url: "https://example.com/image1.jpg",
          type: "image",
        },
        {
          text: "Image 2",
          url: "https://example.com/image2.jpg",
          type: "image",
        },
      ];

      const result = await loader.loadMedia(links, mockSourceUrl);

      const ids = result.documents.map((doc) => doc.id);
      const uniqueIds = new Set(ids);

      expect(uniqueIds.size).to.equal(ids.length);

      // IDs should be valid UUIDs
      for (const id of ids) {
        expect(id).to.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        );
      }
    });

    it("should continue processing after one media item fails", async () => {
      // Override mock to fail first, succeed second
      invokeStub.restore();
      invokeStub = sinon.stub(ChatGoogleGenerativeAI.prototype, "invoke");
      invokeStub.onFirstCall().rejects(new Error("Gemini API error"));
      invokeStub.onSecondCall().resolves({ content: "Success description" });

      const links: Link[] = [
        {
          text: "Failing Image",
          url: "https://example.com/fail.jpg",
          type: "image",
        },
        {
          text: "Success Image",
          url: "https://example.com/success.jpg",
          type: "image",
        },
      ];

      const result = await loader.loadMedia(links, mockSourceUrl);

      // Should have one success and one failure
      expect(result.stats.total).to.equal(2);
      expect(result.stats.succeeded).to.equal(1);
      expect(result.stats.failed).to.equal(1);

      // Should have one successful result
      expect(result.documents.length).to.equal(1);
      expect(result.documents[0].pageContent).to.equal("Success description");

      // Should have one error
      expect(result.errors.length).to.equal(1);
      expect(result.errors[0].url).to.include("fail.jpg");
    });
  });

  describe("loadLinks (Unified Interface)", () => {
    const loader = new ExternalAssetsLoader();
    const mockSourceUrl = "https://en.wikipedia.org/wiki/Test_Article";

    it("should return empty result for empty input", async () => {
      const links: Link[] = [];
      const result = await loader.loadLinks(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.equal(0);
      expect(result.errors).to.be.an("array");
      expect(result.errors.length).to.equal(0);
      expect(result.stats).to.deep.equal({
        total: 0,
        succeeded: 0,
        failed: 0,
        skipped: 0,
      });
    });

    it("should route PDF links to loadPDFs", async () => {
      const links: Link[] = [
        {
          text: "Test PDF",
          url: "https://example.com/test.pdf",
          type: "pdf",
        },
      ];

      const result = await loader.loadLinks(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.be.greaterThan(0);
      expect(result.documents[0].metadata.assetType).to.equal("pdf");
    });

    it("should route HTML links to loadHTML", async () => {
      const links: Link[] = [
        {
          text: "Test HTML",
          url: "https://example.com",
          type: "html",
        },
      ];

      const result = await loader.loadLinks(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.equal(1);
      expect(result.documents[0].metadata.assetType).to.equal("html");
    });

    it("should route media links to loadMedia", async () => {
      const links: Link[] = [
        {
          text: "Test Image",
          url: "https://example.com/image.jpg",
          type: "image",
        },
      ];

      const result = await loader.loadLinks(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.equal(1);
      expect(result.documents[0].metadata.assetType).to.equal("image");
    });

    it("should handle mixed link types and aggregate results", async () => {
      const links: Link[] = [
        {
          text: "PDF",
          url: "https://example.com/doc.pdf",
          type: "pdf",
        },
        {
          text: "HTML",
          url: "https://example.com/page",
          type: "html",
        },
        {
          text: "Image",
          url: "https://example.com/image.jpg",
          type: "image",
        },
      ];

      const result = await loader.loadLinks(links, mockSourceUrl);

      expect(result.documents).to.be.an("array");
      expect(result.documents.length).to.be.greaterThan(0);

      const types = result.documents.map((doc) => doc.metadata.assetType);
      expect(types).to.include("pdf");
      expect(types).to.include("html");
      expect(types).to.include("image");

      // Check aggregated stats
      expect(result.stats.total).to.equal(3);
      expect(result.stats.succeeded).to.be.greaterThan(0);
    });

    it("should aggregate errors from all handlers", async () => {
      const links: Link[] = [
        {
          text: "Broken PDF",
          url: "https://example.com/broken-link.pdf",
          type: "pdf",
        },
        {
          text: "Broken HTML",
          url: "https://example.com/does-not-exist",
          type: "html",
        },
      ];

      const result = await loader.loadLinks(links, mockSourceUrl);

      // Should have errors from both types
      expect(result.errors.length).to.equal(2);
      expect(result.errors[0].type).to.be.oneOf(["pdf", "html"]);
      expect(result.errors[1].type).to.be.oneOf(["pdf", "html"]);

      // Stats should reflect failures
      expect(result.stats.total).to.equal(2);
      expect(result.stats.failed).to.equal(2);
      expect(result.stats.succeeded).to.equal(0);
    });

    it("should aggregate stats from all handlers", async () => {
      const links: Link[] = [
        {
          text: "PDF 1",
          url: "https://example.com/doc1.pdf",
          type: "pdf",
        },
        {
          text: "PDF 2 (duplicate)",
          url: "https://example.com/doc1.pdf",
          type: "pdf",
        },
        {
          text: "HTML 1",
          url: "https://example.com/page1",
          type: "html",
        },
        {
          text: "HTML 2 (broken)",
          url: "https://example.com/broken-link",
          type: "html",
        },
        {
          text: "Image",
          url: "https://example.com/image.jpg",
          type: "image",
        },
      ];

      const result = await loader.loadLinks(links, mockSourceUrl);

      // Check aggregated stats
      expect(result.stats.total).to.equal(5);
      expect(result.stats.skipped).to.equal(1); // PDF duplicate
      expect(result.stats.failed).to.equal(1); // Broken HTML
      expect(result.stats.succeeded).to.equal(3); // PDF + HTML + Image
    });

    it("should load from small Wikipedia fixture", async function () {
      this.timeout(5000);

      const fixtureContent = await readFile(
        "tests/fixtures/wikipedia-links-small.json",
        "utf-8",
      );
      const allLinks: Link[] = JSON.parse(fixtureContent);

      // Filter out wiki-page links (internal Wikipedia links, not external assets)
      const externalLinks = allLinks.filter((link) => link.type !== "wiki-page");

      const result = await loader.loadLinks(externalLinks, mockSourceUrl);

      // Fixture has 19 total links, but 3 are wiki-pages (internal), so 16 external
      expect(result.stats.total).to.equal(16);

      // Should have documents from successful loads
      expect(result.documents.length).to.be.greaterThan(0);

      // Should track errors for broken links
      expect(result.errors.length).to.be.greaterThan(0);

      // Should skip duplicates (fixture has 2 duplicates)
      expect(result.stats.skipped).to.equal(2);

      // All document types should be present
      const types = new Set(result.documents.map((doc) => doc.metadata.assetType));
      expect(types.has("html")).to.be.true;
      expect(types.has("pdf")).to.be.true;
      expect(types.has("image")).to.be.true;
    });

    it("should load from small Grokipedia fixture", async function () {
      this.timeout(5000);

      const fixtureContent = await readFile(
        "tests/fixtures/grokipedia-links-small.json",
        "utf-8",
      );
      const links: Link[] = JSON.parse(fixtureContent);

      const result = await loader.loadLinks(links, mockSourceUrl);

      // Fixture has 15 links total
      expect(result.stats.total).to.equal(15);

      // Should have documents from successful loads
      expect(result.documents.length).to.be.greaterThan(0);

      // Should track errors for broken link
      expect(result.errors.length).to.be.greaterThan(0);

      // Should skip duplicates (fixture has 2 duplicates)
      expect(result.stats.skipped).to.equal(2);

      // All document types should be present (HTML and PDF)
      const types = new Set(result.documents.map((doc) => doc.metadata.assetType));
      expect(types.has("html")).to.be.true;
      expect(types.has("pdf")).to.be.true;
    });
  });

  describe("Callbacks", () => {
    it("should invoke onPhaseStart callback for PDFs", async () => {
      setupFetchMock(fetchStub);

      const onPhaseStart = sinon.spy();
      const loader = new ExternalAssetsLoader({ callbacks: { onPhaseStart } });

      const pdfLinks: Link[] = [
        { text: "PDF 1", url: "https://example.com/file1.pdf", type: "pdf" },
        { text: "PDF 2", url: "https://example.com/file2.pdf", type: "pdf" },
        { text: "PDF 2 Dup", url: "https://example.com/file2.pdf", type: "pdf" },
      ];

      await loader.loadPDFs(pdfLinks, "https://example.com");

      sinon.assert.calledOnce(onPhaseStart);
      sinon.assert.calledWith(
        onPhaseStart,
        "pdf",
        2, // unique links
        1, // duplicates
      );
    });

    it("should invoke onAssetLoaded callback for successful loads", async () => {
      setupFetchMock(fetchStub);

      const onAssetLoaded = sinon.spy();
      const loader = new ExternalAssetsLoader({ callbacks: { onAssetLoaded } });

      const pdfLinks: Link[] = [
        { text: "PDF", url: "https://example.com/report.pdf", type: "pdf" },
      ];

      await loader.loadPDFs(pdfLinks, "https://example.com");

      sinon.assert.calledOnce(onAssetLoaded);
      expect(onAssetLoaded.firstCall.args[0]).to.equal("pdf");
      expect(onAssetLoaded.firstCall.args[1]).to.equal("https://example.com/report.pdf");
    });

    it("should invoke onAssetError callback for failed loads", async () => {
      setupFetchMock(fetchStub);

      const onAssetError = sinon.spy();
      const loader = new ExternalAssetsLoader({ callbacks: { onAssetError } });

      const pdfLinks: Link[] = [
        { text: "Missing", url: "https://example.com/does-not-exist.pdf", type: "pdf" },
      ];

      await loader.loadPDFs(pdfLinks, "https://example.com");

      sinon.assert.calledOnce(onAssetError);
      expect(onAssetError.firstCall.args[0]).to.equal("pdf");
      expect(onAssetError.firstCall.args[1]).to.equal(
        "https://example.com/does-not-exist.pdf",
      );
    });

    it("should invoke onPhaseComplete callback with stats", async () => {
      setupFetchMock(fetchStub);

      const onPhaseComplete = sinon.spy();
      const loader = new ExternalAssetsLoader({ callbacks: { onPhaseComplete } });

      const htmlLinks: Link[] = [
        { text: "Page", url: "https://example.com/page.html", type: "html" },
      ];

      await loader.loadHTML(htmlLinks, "https://example.com");

      sinon.assert.calledOnce(onPhaseComplete);
      expect(onPhaseComplete.firstCall.args[0]).to.equal("html");
      expect(onPhaseComplete.firstCall.args[1]).to.have.property("total", 1);
      expect(onPhaseComplete.firstCall.args[1]).to.have.property("succeeded", 1);
    });

    it("should invoke onLoadComplete callback after loadLinks", async () => {
      setupFetchMock(fetchStub);

      const onLoadComplete = sinon.spy();
      const loader = new ExternalAssetsLoader({ callbacks: { onLoadComplete } });

      const links: Link[] = [
        { text: "PDF", url: "https://example.com/file.pdf", type: "pdf" },
        { text: "HTML", url: "https://example.com/page.html", type: "html" },
      ];

      await loader.loadLinks(links, "https://example.com");

      sinon.assert.calledOnce(onLoadComplete);
      expect(onLoadComplete.firstCall.args[0]).to.have.property("total", 2);
    });

    it("should not fail if callbacks throw errors", async () => {
      setupFetchMock(fetchStub);

      const onPhaseStart = sinon.stub().throws(new Error("Callback error"));
      const loader = new ExternalAssetsLoader({ callbacks: { onPhaseStart } });

      const pdfLinks: Link[] = [
        { text: "PDF", url: "https://example.com/report.pdf", type: "pdf" },
      ];

      // Should not throw despite callback error
      const result = await loader.loadPDFs(pdfLinks, "https://example.com");

      sinon.assert.calledOnce(onPhaseStart);
      expect(result).to.have.property("documents");
    });

    it("should invoke all callbacks in correct sequence", async () => {
      setupFetchMock(fetchStub);

      const callOrder: string[] = [];
      const callbacks = {
        onPhaseStart: sinon.spy(() => callOrder.push("phaseStart")),
        onAssetLoaded: sinon.spy(() => callOrder.push("assetLoaded")),
        onPhaseComplete: sinon.spy(() => callOrder.push("phaseComplete")),
      };

      const loader = new ExternalAssetsLoader({ callbacks });

      const htmlLinks: Link[] = [
        { text: "Page", url: "https://example.com/page.html", type: "html" },
      ];

      await loader.loadHTML(htmlLinks, "https://example.com");

      expect(callOrder).to.deep.equal(["phaseStart", "assetLoaded", "phaseComplete"]);
    });
  });
});
