import { createAgent, toolCallLimitMiddleware } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import type { DkgClient } from "../types.js";
import {
  createExecuteSparqlTool,
  createDiscoverClassesTool,
  createDiscoverPredicatesTool,
  createSampleDataTool,
} from "./tools/index.js";
import { DKG_QUERY_SYSTEM_PROMPT } from "./system-prompt.js";

export async function createDkgQueryAgent(
  dkgClient: DkgClient
): Promise<ReturnType<typeof createAgent>> {
  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.3,
  });

  const tools = [
    createExecuteSparqlTool(dkgClient),
    createDiscoverClassesTool(dkgClient),
    createDiscoverPredicatesTool(dkgClient),
    createSampleDataTool(dkgClient),
  ];

  return createAgent({
    name: "dkg-query-generator",
    model,
    tools,
    systemPrompt: DKG_QUERY_SYSTEM_PROMPT,
    middleware: [toolCallLimitMiddleware({ runLimit: 10 })],
  });
}
