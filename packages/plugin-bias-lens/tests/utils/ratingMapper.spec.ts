import { describe, it } from "mocha";
import { expect } from "chai";
import {
  mapBiasLevelToRating,
  mapConfidenceToRating,
} from "../../src/utils/ratingMapper.js";

describe("Rating Mapper Utility", () => {
  describe("mapBiasLevelToRating", () => {
    it("should map 'none' to rating 5", () => {
      const rating = mapBiasLevelToRating("none");
      expect(rating["@type"]).to.equal("Rating");
      expect(rating.ratingValue).to.equal(5);
      expect(rating.bestRating).to.equal(5);
      expect(rating.worstRating).to.equal(1);
      expect(rating.ratingExplanation).to.include("No significant bias");
    });

    it("should map 'low' to rating 4", () => {
      const rating = mapBiasLevelToRating("low");
      expect(rating.ratingValue).to.equal(4);
      expect(rating.ratingExplanation).to.include("Minor bias");
    });

    it("should map 'moderate' to rating 3", () => {
      const rating = mapBiasLevelToRating("moderate");
      expect(rating.ratingValue).to.equal(3);
      expect(rating.ratingExplanation).to.include("Notable bias");
    });

    it("should map 'high' to rating 2", () => {
      const rating = mapBiasLevelToRating("high");
      expect(rating.ratingValue).to.equal(2);
      expect(rating.ratingExplanation).to.include("Significant bias");
    });

    it("should map 'severe' to rating 1", () => {
      const rating = mapBiasLevelToRating("severe");
      expect(rating.ratingValue).to.equal(1);
      expect(rating.ratingExplanation).to.include("Extreme bias");
    });

    it("should always include @type, bestRating, and worstRating", () => {
      const levels = ["none", "low", "moderate", "high", "severe"] as const;
      for (const level of levels) {
        const rating = mapBiasLevelToRating(level);
        expect(rating["@type"]).to.equal("Rating");
        expect(rating.bestRating).to.equal(5);
        expect(rating.worstRating).to.equal(1);
      }
    });
  });

  describe("mapConfidenceToRating", () => {
    it("should map low confidence (1.0) to rating 1", () => {
      const rating = mapConfidenceToRating(1.0);
      expect(rating["@type"]).to.equal("Rating");
      expect(rating.ratingValue).to.equal(1);
      expect(rating.bestRating).to.equal(5);
      expect(rating.worstRating).to.equal(1);
    });

    it("should map high confidence (0.0) to rating 5", () => {
      const rating = mapConfidenceToRating(0.0);
      expect(rating.ratingValue).to.equal(5);
    });

    it("should map middle confidence (0.5) to rating 3", () => {
      const rating = mapConfidenceToRating(0.5);
      expect(rating.ratingValue).to.equal(3);
    });

    it("should clamp values above 1 to rating 1", () => {
      const rating = mapConfidenceToRating(1.5);
      expect(rating.ratingValue).to.be.at.least(1);
      expect(rating.ratingValue).to.be.at.most(5);
    });

    it("should clamp negative values to valid range", () => {
      const rating = mapConfidenceToRating(-0.5);
      expect(rating.ratingValue).to.be.at.least(1);
      expect(rating.ratingValue).to.be.at.most(5);
    });

    it("should include ratingExplanation for all values", () => {
      const confidences = [0, 0.25, 0.5, 0.75, 1.0];
      for (const conf of confidences) {
        const rating = mapConfidenceToRating(conf);
        expect(rating.ratingExplanation).to.be.a("string");
        expect(rating.ratingExplanation.length).to.be.greaterThan(0);
      }
    });

    it("should produce integer rating values", () => {
      const confidences = [0.1, 0.33, 0.67, 0.9];
      for (const conf of confidences) {
        const rating = mapConfidenceToRating(conf);
        expect(Number.isInteger(rating.ratingValue)).to.be.true;
      }
    });
  });
});
