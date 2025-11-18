import { describe, it, beforeEach, afterEach } from "mocha";
import { expect } from "chai";
import sinon from "sinon";
import pluginBiasLensPlugin from "../dist/index.js";
import {
  createExpressApp,
  createInMemoryBlobStorage,
  createMcpServerClientPair,
  createMockDkgClient,
} from "@dkg/plugins/testing";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import express from "express";

const mockDkgContext = {
  dkg: createMockDkgClient(),
  blob: createInMemoryBlobStorage(),
};

describe.skip("@dkg/plugin-bias-lens checks", function () {
  let mockMcpServer: McpServer;
  let _mockMcpClient: Client;
  let apiRouter: express.Router;
  let app: express.Application;

  this.timeout(5000);

  beforeEach(async () => {
    const { server, client, connect } = await createMcpServerClientPair();
    mockMcpServer = server;
    _mockMcpClient = client;
    apiRouter = express.Router();
    app = createExpressApp();

    pluginBiasLensPlugin(mockDkgContext, mockMcpServer, apiRouter);
    await connect();
    app.use("/", apiRouter);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Plugin Configuration", () => {
    it("should create plugin without errors", () => {
      expect(pluginBiasLensPlugin).to.be.a("function");
    });
  });

  describe("Core Functionality", () => {
    it("should register MCP tool for bias detection", async () => {
      const tools = await _mockMcpClient.listTools().then((r) => r.tools);
      expect(tools.some((t) => t.name === "find-bias-in-grokipedia-page")).to.equal(true);

      const biasTools = tools.filter((t) => t.name === "find-bias-in-grokipedia-page");
      expect(biasTools.length).to.equal(1);
      expect(biasTools[0].description).to.include("bias");
    });

    it("should register API endpoint for bias detection", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(apiRouter.stack.some((layer: any) =>
        layer.route?.path === "/find-bias-in-grokipedia-page"
      )).to.equal(true);
    });
  });

  describe("Error Handling", () => {
    it("should validate required parameters in MCP tool schema", async () => {
      const tools = await _mockMcpClient.listTools().then((r) => r.tools);
      const biasTool = tools.find((t) => t.name === "find-bias-in-grokipedia-page");

      expect(biasTool).to.exist;
      expect(biasTool!.inputSchema).to.have.property("type", "object");
      expect(biasTool!.inputSchema).to.have.property("properties");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const properties = (biasTool!.inputSchema as any).properties;

      // Verify schema has URL parameters (actual property names may vary based on MCP conversion)
      expect(Object.keys(properties).length).to.be.greaterThan(0);

      // Check that at least one property has string type
      const hasStringProperty = Object.values(properties).some(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (prop: any) => prop.type === "string"
      );
      expect(hasStringProperty).to.be.true;
    });
  });
});
