import { calculateModelCost, calculateApiCost } from "./pricingTable.js";

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
}

interface CostResult {
  totalTokens: number;
  totalUSD: number;
}

class CostTracker {
  private modelUsage: Map<string, TokenUsage> = new Map();
  private apiCalls: Map<string, number> = new Map();

  trackTokens(model: string, usage: TokenUsage): void {
    const existing = this.modelUsage.get(model) ?? {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
    };

    this.modelUsage.set(model, {
      inputTokens: existing.inputTokens + usage.inputTokens,
      outputTokens: existing.outputTokens + usage.outputTokens,
      cachedInputTokens:
        (existing.cachedInputTokens ?? 0) + (usage.cachedInputTokens ?? 0),
    });
  }

  trackApiCall(api: string): void {
    const count = this.apiCalls.get(api) ?? 0;
    this.apiCalls.set(api, count + 1);
  }

  calculateCosts(): CostResult {
    let totalUSD = 0;
    let totalTokens = 0;

    for (const [model, usage] of this.modelUsage) {
      const cost = calculateModelCost(
        model,
        usage.inputTokens,
        usage.outputTokens,
        usage.cachedInputTokens
      );
      totalUSD += cost;
      totalTokens +=
        usage.inputTokens +
        usage.outputTokens +
        (usage.cachedInputTokens ?? 0);
    }

    for (const [api, count] of this.apiCalls) {
      const cost = calculateApiCost(api, count);
      totalUSD += cost;
    }

    return { totalTokens, totalUSD };
  }

  reset(): void {
    this.modelUsage.clear();
    this.apiCalls.clear();
  }
}

export { CostTracker };
export type { TokenUsage, CostResult };
