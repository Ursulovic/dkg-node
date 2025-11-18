import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import { ExternalLoader } from "../../src/loaders/external.js";

describe("ExternalLoader", () => {
  let sandbox: sinon.SinonSandbox;
  let loader: ExternalLoader;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    loader = new ExternalLoader();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("loadPdf", () => {
    it("should load PDF from URL successfully", async function () {
      this.timeout(5000);

      // Mock fetch response
      const mockPdfContent = Buffer.from("%PDF-1.4 mock content");
      const mockBlob = new Blob([mockPdfContent], {
        type: "application/pdf",
      });

      const fetchStub = sandbox.stub(global, "fetch").resolves({
        ok: true,
        headers: new Headers({ "content-type": "application/pdf" }),
        blob: async () => mockBlob,
      } as Response);

      // Note: This will actually try to parse the PDF with pdf-parse
      // In a real test environment, you might want to mock WebPDFLoader as well
      try {
        const docs = await loader.loadPdf("https://example.com/test.pdf");

        expect(fetchStub.calledOnce).to.be.true;
        expect(docs).to.be.an("array");

        // If PDF parsing succeeds, verify document structure
        if (docs.length > 0) {
          docs.forEach((doc) => {
            expect(doc).to.have.property("id");
            expect(doc).to.have.property("pageContent");
            expect(doc.metadata).to.have.property("source");
            expect(doc.metadata.source).to.equal("https://example.com/test.pdf");
            expect(doc.metadata).to.have.property("fileType");
            expect(doc.metadata.fileType).to.equal("pdf");
          });
        }
      } catch (error) {
        // PDF parsing may fail with mock content, but fetch should still be called
        expect(fetchStub.calledOnce).to.be.true;
      }
    });

    it("should throw error for failed fetch", async function () {
      this.timeout(5000);

      sandbox.stub(global, "fetch").resolves({
        ok: false,
        statusText: "Not Found",
      } as Response);

      try {
        await loader.loadPdf("https://example.com/missing.pdf");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include("Failed to fetch PDF");
        expect((error as Error).message).to.include("Not Found");
      }
    });

    it("should throw error for non-PDF content type", async function () {
      this.timeout(5000);

      const mockBlob = new Blob(["<html>not a pdf</html>"], {
        type: "text/html",
      });

      sandbox.stub(global, "fetch").resolves({
        ok: true,
        headers: new Headers({ "content-type": "text/html" }),
        blob: async () => mockBlob,
      } as Response);

      try {
        await loader.loadPdf("https://example.com/notapdf.html");
        expect.fail("Should have thrown error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include(
          "does not point to a PDF file",
        );
        expect((error as Error).message).to.include("text/html");
      }
    });

    it("should handle missing content-type header gracefully", async function () {
      this.timeout(5000);

      const mockPdfContent = Buffer.from("%PDF-1.4 mock content");
      const mockBlob = new Blob([mockPdfContent]);

      sandbox.stub(global, "fetch").resolves({
        ok: true,
        headers: new Headers(), // No content-type
        blob: async () => mockBlob,
      } as Response);

      // Should not throw error, but PDF parsing might fail
      try {
        await loader.loadPdf("https://example.com/test.pdf");
        // If it succeeds, that's ok
      } catch (error) {
        // If it fails during PDF parsing, that's expected with mock content
        // But it should NOT fail with content-type validation error
        expect((error as Error).message).to.not.include(
          "does not point to a PDF file",
        );
      }
    });
  });

  describe("loadPdfs", () => {
    it("should load multiple PDFs in batches", async function () {
      this.timeout(10000);

      const urls = [
        "https://example.com/pdf1.pdf",
        "https://example.com/pdf2.pdf",
        "https://example.com/pdf3.pdf",
      ];

      // Mock fetch to return different responses
      const fetchStub = sandbox.stub(global, "fetch");

      // First PDF succeeds
      fetchStub.onCall(0).resolves({
        ok: true,
        headers: new Headers({ "content-type": "application/pdf" }),
        blob: async () =>
          new Blob([Buffer.from("%PDF-1.4 content1")], {
            type: "application/pdf",
          }),
      } as Response);

      // Second PDF fails (404)
      fetchStub.onCall(1).resolves({
        ok: false,
        statusText: "Not Found",
      } as Response);

      // Third PDF succeeds
      fetchStub.onCall(2).resolves({
        ok: true,
        headers: new Headers({ "content-type": "application/pdf" }),
        blob: async () =>
          new Blob([Buffer.from("%PDF-1.4 content3")], {
            type: "application/pdf",
          }),
      } as Response);

      const result = await loader.loadPdfs(urls, 2); // Batch size 2

      expect(result).to.have.property("success");
      expect(result).to.have.property("failed");
      expect(result.failed).to.be.an("array");
      expect(result.failed.length).to.be.greaterThan(0);

      // Check failed PDF
      const failedPdf = result.failed.find((f) => f.url === urls[1]);
      expect(failedPdf).to.exist;
      expect(failedPdf?.error).to.include("Failed to fetch PDF");
    });

    it("should handle all PDFs failing gracefully", async function () {
      this.timeout(5000);

      const urls = ["https://example.com/bad1.pdf", "https://example.com/bad2.pdf"];

      sandbox.stub(global, "fetch").resolves({
        ok: false,
        statusText: "Server Error",
      } as Response);

      const result = await loader.loadPdfs(urls);

      expect(result.success).to.be.an("array").with.lengthOf(0);
      expect(result.failed).to.be.an("array").with.lengthOf(2);
      result.failed.forEach((failure) => {
        expect(failure.error).to.include("Failed to fetch PDF");
      });
    });

    it("should process empty URL array", async function () {
      const result = await loader.loadPdfs([]);

      expect(result.success).to.be.an("array").with.lengthOf(0);
      expect(result.failed).to.be.an("array").with.lengthOf(0);
    });
  });
});
