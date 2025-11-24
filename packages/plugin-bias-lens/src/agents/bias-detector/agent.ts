import { z } from "zod";

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

import systemPrompt from "./prompt";
import responseFormat from "./schema";

import { researchClaimTool } from "../claim-researcher/agent";

const model = new ChatOpenAI({
  model: "gpt-4.1",
  temperature: 0,
  cache: true,
  reasoning: { effort: "none" },
});

export default createAgent({
  name: "bias-detector",
  model,
  tools: [researchClaimTool],
  contextSchema: z.object({}),
  responseFormat,
  systemPrompt,
});
