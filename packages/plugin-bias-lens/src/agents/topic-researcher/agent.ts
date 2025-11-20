import { z } from "zod";

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

import systemPrompt from "./prompt";
import responseFormat from "./schema";
import { webSearchTool } from "./tools/web-search";

const model = new ChatOpenAI({
  model: "gpt-4o",
  temperature: 0.5,
  cache: true,
  reasoning: { effort: "high" },
});

export default createAgent({
  name: "topic-researcher",
  model,
  tools: [webSearchTool],
  contextSchema: z.object({}),
  responseFormat,
  systemPrompt,
});
