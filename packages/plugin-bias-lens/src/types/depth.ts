export type AnalysisDepth = "low" | "medium" | "high";

export interface DepthConfig {
  depth: AnalysisDepth;
  maxClaims: number | null;
  description: string;
}

export const DEPTH_CONFIGS: Record<AnalysisDepth, DepthConfig> = {
  low: {
    depth: "low",
    maxClaims: 10,
    description: "Quick analysis (~30s) - top 5-10 critical claims only",
  },
  medium: {
    depth: "medium",
    maxClaims: 25,
    description: "Balanced analysis (~90s) - top 15-25 significant claims",
  },
  high: {
    depth: "high",
    maxClaims: null,
    description: "Thorough analysis (~3min) - all verifiable claims",
  },
};
