type BiasLevel = "none" | "low" | "moderate" | "high" | "severe";

interface Rating {
  "@type": "Rating";
  ratingValue: 1 | 2 | 3 | 4 | 5;
  bestRating: 5;
  worstRating: 1;
  ratingExplanation: string;
}

const biasLevelToRating: Record<BiasLevel, 1 | 2 | 3 | 4 | 5> = {
  none: 5,
  low: 4,
  moderate: 3,
  high: 2,
  severe: 1,
};

const biasLevelDescriptions: Record<BiasLevel, string> = {
  none: "No significant bias detected - article aligns with Wikipedia baseline",
  low: "Minor bias issues detected - mostly accurate with small discrepancies",
  moderate: "Notable bias detected - several issues requiring attention",
  high: "Significant bias detected - serious accuracy concerns",
  severe: "Extreme bias detected - extensive misinformation present",
};

function mapBiasLevelToRating(biasLevel: BiasLevel): Rating {
  return {
    "@type": "Rating",
    ratingValue: biasLevelToRating[biasLevel],
    bestRating: 5,
    worstRating: 1,
    ratingExplanation: biasLevelDescriptions[biasLevel],
  };
}

function mapConfidenceToRating(confidence: number): Rating {
  const ratingValue = Math.max(1, Math.min(5, Math.round((1 - confidence) * 4 + 1))) as
    | 1
    | 2
    | 3
    | 4
    | 5;

  const explanations: Record<1 | 2 | 3 | 4 | 5, string> = {
    1: "Very low confidence in accuracy",
    2: "Low confidence in accuracy",
    3: "Moderate confidence in accuracy",
    4: "Good confidence in accuracy",
    5: "High confidence in accuracy",
  };

  return {
    "@type": "Rating",
    ratingValue,
    bestRating: 5,
    worstRating: 1,
    ratingExplanation: explanations[ratingValue],
  };
}

export { mapBiasLevelToRating, mapConfidenceToRating };
export type { BiasLevel, Rating };
