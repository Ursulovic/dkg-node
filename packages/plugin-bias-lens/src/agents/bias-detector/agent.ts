import { z } from "zod";

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";

import systemPrompt from "./prompt";
import responseFormat from "./schema";
import { webSearchTool } from "./tools/web-search";
import { googleScholarSearchTool } from "./tools/google-scholar-search";
import { wikidataQueryTool } from "./tools/wikidata";

const model = new ChatOpenAI({
  model: "gpt-4.1",
  temperature: 0,
  cache: true,
  reasoning: { effort: "high" },
});

export default createAgent({
  name: "bias-detector",
  model,
  tools: [webSearchTool, googleScholarSearchTool, wikidataQueryTool],
  contextSchema: z.object({}),
  responseFormat,
  systemPrompt,
});
