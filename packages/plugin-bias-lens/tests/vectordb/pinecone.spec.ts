import { describe, it } from "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import { Document } from "@langchain/core/documents";
import {
  Pinecone as PineconeClient,
  type Index,
  type RecordMetadata,
} from "@pinecone-database/pinecone";
import { PineconeStore } from "@langchain/pinecone";
import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PineconeRAG } from "../../src/vectordb/pinecone";

describe("PineconeRAG", () => {
  let sandbox: sinon.SinonSandbox;
  let pineconeStub: sinon.SinonStub;
  let pineconeStoreStub: sinon.SinonStub;
  let textSplitterStub: sinon.SinonStub;
  let mockPineconeIndex: { namespace: sinon.SinonStub };
  let mockVectorStore: {
    addDocuments: sinon.SinonStub;
    similaritySearch: sinon.SinonStub;
    delete: sinon.SinonStub;
  };

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    // Set up required environment variables
    process.env.PINECONE_API_KEY = "test-pinecone-key";
    process.env.PINECONE_INDEX = "test-index";
    process.env.OPENAI_API_KEY = "test-openai-key";

    // Mock Pinecone index
    mockPineconeIndex = {
      namespace: sinon.stub().returnsThis(),
    };

    // Mock PineconeStore methods
    mockVectorStore = {
      addDocuments: sinon.stub().resolves(["id1", "id2"]),
      similaritySearch: sinon.stub().resolves([]),
      delete: sinon.stub().resolves(),
    };

    pineconeStub = sandbox
      .stub(PineconeClient.prototype, "Index")
      .returns(mockPineconeIndex as unknown as Index<RecordMetadata>);

    // Stub PineconeStore to return our mock
    pineconeStoreStub = sandbox
      .stub(PineconeStore.prototype, "addDocuments")
      .callsFake(mockVectorStore.addDocuments);

    sandbox
      .stub(PineconeStore.prototype, "similaritySearch")
      .callsFake(mockVectorStore.similaritySearch);

    sandbox
      .stub(OpenAIEmbeddings.prototype, "embedQuery")
      .resolves([0.1, 0.2, 0.3]);

    textSplitterStub = sandbox
      .stub(RecursiveCharacterTextSplitter.prototype, "splitDocuments")
      .callsFake(async (docs) => docs);
  });

  afterEach(() => {
    sandbox.restore();
    delete process.env.PINECONE_API_KEY;
    delete process.env.PINECONE_INDEX;
    delete process.env.OPENAI_API_KEY;
  });

  describe("Core Functionality", () => {
    describe("constructor", () => {
      it("should initialize with environment variables", () => {
        const rag = new PineconeRAG();

        expect(rag).to.be.instanceOf(PineconeRAG);
        sinon.assert.calledOnce(pineconeStub);
        sinon.assert.calledWith(pineconeStub, "test-index");
      });

      it("should initialize with custom config", () => {
        const config = {
          apiKey: "custom-pinecone-key",
          indexName: "custom-index",
          openaiApiKey: "custom-openai-key",
          embeddingModel: "text-embedding-3-small",
          maxConcurrency: 10,
          dimensions: 512,
        };

        const rag = new PineconeRAG(config);

        expect(rag).to.be.instanceOf(PineconeRAG);
        // Verify Index was called with custom index name
        sinon.assert.calledWith(pineconeStub, "custom-index");
      });

      it("should use default dimensions if not specified", () => {
        const rag = new PineconeRAG();

        expect(rag).to.be.instanceOf(PineconeRAG);
      });

      it("should use custom dimensions configuration", () => {
        const config = {
          apiKey: "test-key",
          indexName: "test-index",
          openaiApiKey: "test-openai-key",
          dimensions: 3072,
        };

        const rag = new PineconeRAG(config);

        expect(rag).to.be.instanceOf(PineconeRAG);
      });
    });

    describe("upsert", () => {
      it("should index new documents successfully", async () => {
        const rag = new PineconeRAG();
        mockVectorStore.similaritySearch.resolves([]); // Not indexed

        const documents = [
          new Document({
            pageContent: "Test content",
            metadata: { source: "https://example.com/page1", title: "Test" },
          }),
        ];

        const result = await rag.upsert(documents);

        expect(result.indexed).to.deep.equal(["https://example.com/page1"]);
        expect(result.cached).to.be.empty;
        sinon.assert.calledOnce(pineconeStoreStub);
      });

      it("should handle multiple documents in one batch", async () => {
        const rag = new PineconeRAG();
        mockVectorStore.similaritySearch.resolves([]); // Not indexed

        const documents = [
          new Document({
            pageContent: "Content 1",
            metadata: { source: "https://example.com/page1", title: "Test 1" },
          }),
          new Document({
            pageContent: "Content 2",
            metadata: { source: "https://example.com/page2" },
          }),
        ];

        const result = await rag.upsert(documents);

        expect(result.indexed).to.have.lengthOf(2);
        expect(result.cached).to.be.empty;
        sinon.assert.calledOnce(pineconeStoreStub);
        const addedDocs = pineconeStoreStub.getCall(0).args[0];
        expect(addedDocs).to.have.lengthOf(2);
        expect(addedDocs[0].metadata.documentType).to.equal("grokipedia");
        expect(addedDocs[1].metadata.documentType).to.equal("wikipedia");
      });

      it("should preserve metadata in indexed documents", async () => {
        const rag = new PineconeRAG();
        mockVectorStore.similaritySearch.resolves([]);

        const documents = [
          new Document({
            pageContent: "Test content",
            metadata: {
              source: "https://grokipedia.com/wiki/Test",
              title: "Test Article",
            },
          }),
        ];

        await rag.upsert(documents);

        sinon.assert.calledOnce(pineconeStoreStub);
        const addedDocs = pineconeStoreStub.getCall(0).args[0];
        expect(addedDocs[0].metadata).to.include({
          source: "https://grokipedia.com/wiki/Test",
          title: "Test Article",
          documentType: "grokipedia",
        });
        expect(addedDocs[0].metadata.indexedAt).to.be.a("string");
      });
    });

    describe("retrieve", () => {
      it("should perform semantic search successfully", async () => {
        const rag = new PineconeRAG();
        const mockResults = [
          new Document({
            pageContent: "Result 1",
            metadata: { source: "https://example.com/1" },
          }),
        ];
        mockVectorStore.similaritySearch.resolves(mockResults);

        const results = await rag.retrieve("test query");

        expect(results).to.deep.equal(mockResults);
        sinon.assert.calledOnce(mockVectorStore.similaritySearch);
        sinon.assert.calledWith(
          mockVectorStore.similaritySearch,
          "test query",
          3,
          undefined,
        );
      });

      it("should use custom k value", async () => {
        const rag = new PineconeRAG();
        mockVectorStore.similaritySearch.resolves([]);

        await rag.retrieve("test query", { k: 5 });

        sinon.assert.calledWith(
          mockVectorStore.similaritySearch,
          "test query",
          5,
          undefined,
        );
      });
    });
  });

  describe("Error Handling", () => {
    it("should throw error if PINECONE_API_KEY is missing", () => {
      delete process.env.PINECONE_API_KEY;

      expect(() => new PineconeRAG()).to.throw("PINECONE_API_KEY is required");
    });

    it("should throw error if PINECONE_INDEX is missing", () => {
      delete process.env.PINECONE_INDEX;

      expect(() => new PineconeRAG()).to.throw("PINECONE_INDEX is required");
    });

    it("should throw error if OPENAI_API_KEY is missing", () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => new PineconeRAG()).to.throw("OPENAI_API_KEY is required");
    });

    it("should throw error if documents array is empty", async () => {
      const rag = new PineconeRAG();

      try {
        await rag.upsert([]);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal(
          "Documents array cannot be empty",
        );
      }
    });

    it("should throw error if document missing source metadata", async () => {
      const rag = new PineconeRAG();
      const documents = [
        new Document({
          pageContent: "Test",
          metadata: { title: "No source" },
        }),
      ];

      try {
        await rag.upsert(documents);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal(
          "Document metadata must include a 'source' field",
        );
      }
    });

    it("should handle network failures gracefully", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.rejects(new Error("Network error"));

      try {
        await rag.retrieve("test");
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal("Network error");
      }
    });

    it("should handle addDocuments failures", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([]);
      mockVectorStore.addDocuments.rejects(new Error("Pinecone error"));

      const documents = [
        new Document({
          pageContent: "Test",
          metadata: { source: "https://example.com" },
        }),
      ];

      try {
        await rag.upsert(documents);
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.equal("Pinecone error");
      }
    });
  });

  describe("Deduplication", () => {
    it("should skip documents that are already indexed", async () => {
      const rag = new PineconeRAG();
      // First call returns existing document, second call returns empty
      mockVectorStore.similaritySearch
        .onFirstCall()
        .resolves([
          new Document({
            pageContent: "Existing",
            metadata: { source: "https://example.com/page1" },
          }),
        ])
        .onSecondCall()
        .resolves([]);

      const documents = [
        new Document({
          pageContent: "Test 1",
          metadata: { source: "https://example.com/page1" },
        }),
        new Document({
          pageContent: "Test 2",
          metadata: { source: "https://example.com/page2" },
        }),
      ];

      const result = await rag.upsert(documents);

      expect(result.cached).to.deep.equal(["https://example.com/page1"]);
      expect(result.indexed).to.deep.equal(["https://example.com/page2"]);
      sinon.assert.calledOnce(pineconeStoreStub);
      const addedDocs = pineconeStoreStub.getCall(0).args[0];
      expect(addedDocs).to.have.lengthOf(1);
      expect(addedDocs[0].metadata.source).to.equal(
        "https://example.com/page2",
      );
    });

    it("should return all cached if all documents already indexed", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([
        new Document({ pageContent: "Existing", metadata: {} }),
      ]);

      const documents = [
        new Document({
          pageContent: "Test",
          metadata: { source: "https://example.com/page1" },
        }),
      ];

      const result = await rag.upsert(documents);

      expect(result.cached).to.deep.equal(["https://example.com/page1"]);
      expect(result.indexed).to.be.empty;
      sinon.assert.notCalled(pineconeStoreStub);
    });

    it("should correctly identify indexed documents", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([
        new Document({ pageContent: "Found", metadata: {} }),
      ]);

      const isIndexed = await rag.isIndexed("https://example.com/page1");

      expect(isIndexed).to.be.true;
      sinon.assert.calledOnce(mockVectorStore.similaritySearch);
      sinon.assert.calledWith(mockVectorStore.similaritySearch, "", 1, {
        source: "https://example.com/page1",
      });
    });

    it("should return false for non-indexed documents", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([]);

      const isIndexed = await rag.isIndexed("https://example.com/new-page");

      expect(isIndexed).to.be.false;
    });
  });

  describe("Filtering", () => {
    it("should filter by source URL", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([]);

      await rag.retrieve("test query", {
        filter: { source: "https://grokipedia.com/wiki/Test" },
      });

      sinon.assert.calledWith(
        mockVectorStore.similaritySearch,
        "test query",
        3,
        { source: "https://grokipedia.com/wiki/Test" },
      );
    });

    it("should filter by title", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([]);

      await rag.retrieve("test query", {
        filter: { title: "Climate Change" },
      });

      sinon.assert.calledWith(
        mockVectorStore.similaritySearch,
        "test query",
        3,
        { title: "Climate Change" },
      );
    });

    it("should filter by documentType", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([]);

      await rag.retrieve("test query", {
        filter: { documentType: "grokipedia" },
      });

      sinon.assert.calledWith(
        mockVectorStore.similaritySearch,
        "test query",
        3,
        { documentType: "grokipedia" },
      );
    });

    it("should filter by multiple metadata fields", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([]);

      await rag.retrieve("test query", {
        filter: {
          source: "https://grokipedia.com/wiki/Test",
          documentType: "grokipedia",
        },
      });

      sinon.assert.calledWith(
        mockVectorStore.similaritySearch,
        "test query",
        3,
        {
          source: "https://grokipedia.com/wiki/Test",
          documentType: "grokipedia",
        },
      );
    });

    it("should search entire index with no filter", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([]);

      await rag.retrieve("test query");

      sinon.assert.calledWith(
        mockVectorStore.similaritySearch,
        "test query",
        3,
        undefined,
      );
    });

    it("should return filtered results correctly", async () => {
      const rag = new PineconeRAG();
      const mockResults = [
        new Document({
          pageContent: "Test content",
          metadata: { source: "https://example.com/article", title: "Test" },
        }),
      ];
      mockVectorStore.similaritySearch.resolves(mockResults);

      const results = await rag.retrieve("test", {
        filter: { source: "https://example.com/article" },
      });

      expect(results).to.have.lengthOf(1);
      expect(results[0].metadata.source).to.equal(
        "https://example.com/article",
      );
    });
  });

  describe("Chunking", () => {
    it("should split documents before upserting", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([]);

      const documents = [
        new Document({
          pageContent: "Test content",
          metadata: { source: "https://example.com/page1", title: "Test" },
        }),
      ];

      await rag.upsert(documents);

      sinon.assert.calledOnce(textSplitterStub);
      const splitDocs = textSplitterStub.getCall(0).args[0];
      expect(splitDocs).to.have.lengthOf(1);
      expect(splitDocs[0].metadata.source).to.equal(
        "https://example.com/page1",
      );
    });

    it("should preserve metadata across chunks", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([]);

      textSplitterStub.restore();
      textSplitterStub = sandbox
        .stub(RecursiveCharacterTextSplitter.prototype, "splitDocuments")
        .callsFake(async (docs) => [
          new Document({
            pageContent: "Chunk 1",
            metadata: docs[0].metadata,
          }),
          new Document({
            pageContent: "Chunk 2",
            metadata: docs[0].metadata,
          }),
        ]);

      const documents = [
        new Document({
          pageContent: "Long content that gets split",
          metadata: {
            source: "https://grokipedia.com/wiki/Test",
            title: "Test Article",
          },
        }),
      ];

      await rag.upsert(documents);

      sinon.assert.calledOnce(pineconeStoreStub);
      const addedDocs = pineconeStoreStub.getCall(0).args[0];
      expect(addedDocs).to.have.lengthOf(2);
      expect(addedDocs[0].metadata).to.include({
        source: "https://grokipedia.com/wiki/Test",
        title: "Test Article",
        documentType: "grokipedia",
      });
      expect(addedDocs[1].metadata).to.include({
        source: "https://grokipedia.com/wiki/Test",
        title: "Test Article",
        documentType: "grokipedia",
      });
    });

    it("should use custom chunk size configuration", () => {
      const config = {
        apiKey: "test-key",
        indexName: "test-index",
        openaiApiKey: "test-openai-key",
        chunkSize: 500,
        chunkOverlap: 50,
      };

      const rag = new PineconeRAG(config);
      expect(rag).to.be.instanceOf(PineconeRAG);
    });

    it("should use default chunk size if not specified", () => {
      const rag = new PineconeRAG();
      expect(rag).to.be.instanceOf(PineconeRAG);
    });

    it("should not split documents that are already cached", async () => {
      const rag = new PineconeRAG();
      mockVectorStore.similaritySearch.resolves([
        new Document({
          pageContent: "Existing",
          metadata: { source: "https://example.com/page1" },
        }),
      ]);

      const documents = [
        new Document({
          pageContent: "Test",
          metadata: { source: "https://example.com/page1" },
        }),
      ];

      await rag.upsert(documents);

      sinon.assert.notCalled(textSplitterStub);
      sinon.assert.notCalled(pineconeStoreStub);
    });
  });

});
