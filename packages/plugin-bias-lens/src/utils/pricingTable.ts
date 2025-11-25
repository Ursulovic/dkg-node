interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedInputPerMillion?: number;
}

interface ApiPricing {
  costPerCall: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "gpt-4.1": {
    inputPerMillion: 2.0,
    outputPerMillion: 8.0,
    cachedInputPerMillion: 0.5,
  },
  "gpt-4o-mini": {
    inputPerMillion: 0.15,
    outputPerMillion: 0.6,
  },
  "gpt-4o": {
    inputPerMillion: 2.5,
    outputPerMillion: 10.0,
    cachedInputPerMillion: 0.625,
  },
  "text-embedding-3-large": {
    inputPerMillion: 0.13,
    outputPerMillion: 0,
  },
  "text-embedding-3-small": {
    inputPerMillion: 0.02,
    outputPerMillion: 0,
  },
};

const API_PRICING: Record<string, ApiPricing> = {
  "tavily-basic": { costPerCall: 0.008 },
  "tavily-advanced": { costPerCall: 0.016 },
  serpapi: { costPerCall: 0.01 },
  wikipedia: { costPerCall: 0 },
};

function getModelPricing(model: string): ModelPricing | undefined {
  return MODEL_PRICING[model];
}

function getApiPricing(api: string): ApiPricing | undefined {
  return API_PRICING[api];
}

function calculateModelCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cachedInputTokens: number = 0
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    return 0;
  }

  const inputCost = (inputTokens / 1_000_000) * pricing.inputPerMillion;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPerMillion;
  const cachedCost =
    pricing.cachedInputPerMillion !== undefined
      ? (cachedInputTokens / 1_000_000) * pricing.cachedInputPerMillion
      : 0;

  return inputCost + outputCost + cachedCost;
}

function calculateApiCost(api: string, callCount: number): number {
  const pricing = API_PRICING[api];
  if (!pricing) {
    return 0;
  }
  return callCount * pricing.costPerCall;
}

export {
  MODEL_PRICING,
  API_PRICING,
  getModelPricing,
  getApiPricing,
  calculateModelCost,
  calculateApiCost,
};
export type { ModelPricing, ApiPricing };
