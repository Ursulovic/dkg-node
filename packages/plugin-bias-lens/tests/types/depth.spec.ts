import { describe, it } from "mocha";
import { expect } from "chai";
import {
  DEPTH_CONFIGS,
  type AnalysisDepth,
  type DepthConfig,
} from "../../src/types/depth.js";
import { generatePrompt } from "../../src/agents/bias-detector/prompt.js";

describe("Analysis Depth Configuration", () => {
  describe("DEPTH_CONFIGS", () => {
    it("should have all three depth levels defined", () => {
      expect(DEPTH_CONFIGS).to.have.property("low");
      expect(DEPTH_CONFIGS).to.have.property("medium");
      expect(DEPTH_CONFIGS).to.have.property("high");
    });

    it("should have correct maxClaims for low depth", () => {
      expect(DEPTH_CONFIGS.low.depth).to.equal("low");
      expect(DEPTH_CONFIGS.low.maxClaims).to.equal(10);
      expect(DEPTH_CONFIGS.low.description).to.include("5-10");
    });

    it("should have correct maxClaims for medium depth", () => {
      expect(DEPTH_CONFIGS.medium.depth).to.equal("medium");
      expect(DEPTH_CONFIGS.medium.maxClaims).to.equal(25);
      expect(DEPTH_CONFIGS.medium.description).to.include("15-25");
    });

    it("should have null maxClaims for high depth (unlimited)", () => {
      expect(DEPTH_CONFIGS.high.depth).to.equal("high");
      expect(DEPTH_CONFIGS.high.maxClaims).to.be.null;
      expect(DEPTH_CONFIGS.high.description).to.include("all");
    });

    it("should have descriptions for all depth levels", () => {
      const depths: AnalysisDepth[] = ["low", "medium", "high"];
      for (const depth of depths) {
        expect(DEPTH_CONFIGS[depth].description).to.be.a("string");
        expect(DEPTH_CONFIGS[depth].description.length).to.be.greaterThan(0);
      }
    });
  });

  describe("generatePrompt", () => {
    it("should generate different prompts for each depth level", () => {
      const lowPrompt = generatePrompt(DEPTH_CONFIGS.low);
      const mediumPrompt = generatePrompt(DEPTH_CONFIGS.medium);
      const highPrompt = generatePrompt(DEPTH_CONFIGS.high);

      expect(lowPrompt).to.not.equal(mediumPrompt);
      expect(mediumPrompt).to.not.equal(highPrompt);
      expect(lowPrompt).to.not.equal(highPrompt);
    });

    it("should include depth level in LOW prompt", () => {
      const prompt = generatePrompt(DEPTH_CONFIGS.low);

      expect(prompt).to.include("Analysis Depth: LOW");
      expect(prompt).to.include("QUICK ANALYSIS MODE");
      expect(prompt).to.include("TOP 5-10 claims");
    });

    it("should include depth level in MEDIUM prompt", () => {
      const prompt = generatePrompt(DEPTH_CONFIGS.medium);

      expect(prompt).to.include("Analysis Depth: MEDIUM");
      expect(prompt).to.include("BALANCED ANALYSIS MODE");
      expect(prompt).to.include("TOP 15-25");
    });

    it("should include depth level in HIGH prompt", () => {
      const prompt = generatePrompt(DEPTH_CONFIGS.high);

      expect(prompt).to.include("Analysis Depth: HIGH");
      expect(prompt).to.include("COMPREHENSIVE ANALYSIS MODE");
      expect(prompt).to.include("ALL claims");
    });

    it("should include maxClaims guidance in prompt for limited depths", () => {
      const lowPrompt = generatePrompt(DEPTH_CONFIGS.low);
      const mediumPrompt = generatePrompt(DEPTH_CONFIGS.medium);

      expect(lowPrompt).to.include("up to 10 claims");
      expect(mediumPrompt).to.include("up to 25 claims");
    });

    it("should include unlimited guidance in HIGH prompt", () => {
      const highPrompt = generatePrompt(DEPTH_CONFIGS.high);

      expect(highPrompt).to.include("No limit");
      expect(highPrompt).to.include("comprehensive");
    });

    it("should always include mandatory tool usage section", () => {
      const depths: AnalysisDepth[] = ["low", "medium", "high"];

      for (const depth of depths) {
        const prompt = generatePrompt(DEPTH_CONFIGS[depth]);
        expect(prompt).to.include("MANDATORY TOOL USAGE");
        expect(prompt).to.include("research_claim");
      }
    });

    it("should always include bias level scoring section", () => {
      const depths: AnalysisDepth[] = ["low", "medium", "high"];

      for (const depth of depths) {
        const prompt = generatePrompt(DEPTH_CONFIGS[depth]);
        expect(prompt).to.include("Bias Level Scoring");
        expect(prompt).to.include("NONE");
        expect(prompt).to.include("LOW");
        expect(prompt).to.include("MODERATE");
        expect(prompt).to.include("HIGH");
        expect(prompt).to.include("SEVERE");
      }
    });
  });
});
