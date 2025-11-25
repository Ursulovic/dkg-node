export type AnalysisDepth = "low" | "medium" | "high";

export interface DepthConfig {
  depth: AnalysisDepth;
  maxClaims: number;
  toolCallsPerTool: number;
  toolCallBuffer: number;
  description: string;
}

export const DEPTH_CONFIGS: Record<AnalysisDepth, DepthConfig> = {
  low: {
    depth: "low",
    maxClaims: 5,
    toolCallsPerTool: 1,
    toolCallBuffer: 5,
    description: "Quick analysis (~30s) - top 5 critical claims only",
  },
  medium: {
    depth: "medium",
    maxClaims: 15,
    toolCallsPerTool: 2,
    toolCallBuffer: 5,
    description: "Balanced analysis (~90s) - top 10-15 significant claims",
  },
  high: {
    depth: "high",
    maxClaims: 25,
    toolCallsPerTool: 3,
    toolCallBuffer: 5,
    description: "Thorough analysis (~3min) - comprehensive claim verification",
  },
};
