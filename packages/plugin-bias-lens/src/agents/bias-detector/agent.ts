import { z } from "zod";

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

import { generatePrompt } from "./prompt.js";
import responseFormat from "./schema.js";

import { researchClaimTool } from "../claim-researcher/agent.js";
import { DEPTH_CONFIGS, type AnalysisDepth } from "../../types/depth.js";

const model = new ChatOpenAI({
  model: "gpt-4.1",
  temperature: 0,
  cache: true,
  reasoning: { effort: "none" },
});

export function createBiasDetectorAgent(depth: AnalysisDepth = "medium") {
  const config = DEPTH_CONFIGS[depth];

  return createAgent({
    name: "bias-detector",
    model,
    tools: [researchClaimTool],
    contextSchema: z.object({}),
    responseFormat,
    systemPrompt: generatePrompt(config),
  });
}

export default createBiasDetectorAgent("medium");
