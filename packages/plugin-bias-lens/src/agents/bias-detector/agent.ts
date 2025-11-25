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

const model = new ChatOpenAI({
  model: "gpt-4.1",
  temperature: 0,
  cache: true,
  reasoning: { effort: "none" },
});

export function createBiasDetectorAgent(depth: AnalysisDepth = "medium") {
  const config = DEPTH_CONFIGS[depth];
  const researchClaimTool = createResearchClaimTool(depth);

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
