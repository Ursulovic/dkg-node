import { describe, it } from "mocha";
import { expect } from "chai";
import {
  DEPTH_CONFIGS,
  type AnalysisDepth,
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
      expect(DEPTH_CONFIGS.low.maxClaims).to.equal(5);
      expect(DEPTH_CONFIGS.low.description).to.include("5");
    });

    it("should have correct maxClaims for medium depth", () => {
      expect(DEPTH_CONFIGS.medium.depth).to.equal("medium");
      expect(DEPTH_CONFIGS.medium.maxClaims).to.equal(15);
      expect(DEPTH_CONFIGS.medium.description).to.include("10-15");
    });

    it("should have correct maxClaims for high depth", () => {
      expect(DEPTH_CONFIGS.high.depth).to.equal("high");
      expect(DEPTH_CONFIGS.high.maxClaims).to.equal(25);
      expect(DEPTH_CONFIGS.high.description).to.include("comprehensive");
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

    it("should include depth level in prompt", () => {
      const lowPrompt = generatePrompt(DEPTH_CONFIGS.low);
      const mediumPrompt = generatePrompt(DEPTH_CONFIGS.medium);
      const highPrompt = generatePrompt(DEPTH_CONFIGS.high);

      expect(lowPrompt).to.include("ANALYSIS DEPTH");
      expect(mediumPrompt).to.include("ANALYSIS DEPTH");
      expect(highPrompt).to.include("ANALYSIS DEPTH");
    });

    it("should include maxClaims guidance in prompt", () => {
      const lowPrompt = generatePrompt(DEPTH_CONFIGS.low);
      const mediumPrompt = generatePrompt(DEPTH_CONFIGS.medium);
      const highPrompt = generatePrompt(DEPTH_CONFIGS.high);

      expect(lowPrompt).to.include("up to 5 claims");
      expect(mediumPrompt).to.include("up to 15 claims");
      expect(highPrompt).to.include("up to 25 claims");
    });

    it("should include research_claim tool guidance", () => {
      const depths: AnalysisDepth[] = ["low", "medium", "high"];

      for (const depth of depths) {
        const prompt = generatePrompt(DEPTH_CONFIGS[depth]);
        expect(prompt).to.include("research_claim");
      }
    });

    it("should include error types guidance", () => {
      const depths: AnalysisDepth[] = ["low", "medium", "high"];

      for (const depth of depths) {
        const prompt = generatePrompt(DEPTH_CONFIGS[depth]);
        expect(prompt).to.include("factualError");
        expect(prompt).to.include("missingContext");
        expect(prompt).to.include("sourceProblem");
        expect(prompt).to.include("mediaIssue");
      }
    });
  });
});
