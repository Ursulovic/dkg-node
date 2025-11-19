import { createAgent } from "langchain";
import { z } from "zod";
import systemPrompt from "./prompt";
import tools from "./tools";
import responseFormat from "./schema";
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4.1",
  temperature: 0,
  reasoning: { effort: "high" },
});

export default createAgent({
  name: "bias-detector",
  model,
  tools,
  contextSchema: z.object({}),
  responseFormat,
  systemPrompt,
});
