import { z } from "zod";

import {
  createAgent,
  toolCallLimitMiddleware,
  type ResponseFormat,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";

import { generatePrompt } from "./prompt.js";
import { LLMResponseJsonSchema } from "./schema.js";

import { createResearchClaimTool } from "../claim-researcher/agent.js";
import { DEPTH_CONFIGS, type AnalysisDepth } from "../../types/depth.js";
import { type CostTracker } from "../../utils/costTracker.js";

const MODEL_NAME = "gpt-4.1";

function createModel(costTracker?: CostTracker) {
  return new ChatOpenAI({
    model: MODEL_NAME,
    temperature: 0,
    cache: true,
    reasoning: { effort: "none" },
    callbacks: costTracker
      ? [
          {
            handleLLMEnd(output) {
              const usage = output.llmOutput?.tokenUsage;
              if (usage) {
                costTracker.trackTokens(MODEL_NAME, {
                  inputTokens: usage.promptTokens ?? 0,
                  outputTokens: usage.completionTokens ?? 0,
                });
              }
            },
          },
        ]
      : undefined,
  });
}

export function createBiasDetectorAgent(
  depth: AnalysisDepth = "medium",
  costTracker?: CostTracker
) {
  const config = DEPTH_CONFIGS[depth];
  const researchClaimTool = createResearchClaimTool(depth, costTracker);
  const model = createModel(costTracker);

  return createAgent({
    name: "bias-detector",
    model,
    tools: [researchClaimTool],
    contextSchema: z.object({}),
    responseFormat: LLMResponseJsonSchema as ResponseFormat,
    systemPrompt: generatePrompt(config),
    middleware: [
      toolCallLimitMiddleware({
        toolName: "research_claim",
        runLimit: config.maxClaims + 5,
        exitBehavior: "continue",
      }),
    ],
  });
}

export default createBiasDetectorAgent("medium");
