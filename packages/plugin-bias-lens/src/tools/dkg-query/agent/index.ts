import { createAgent, toolCallLimitMiddleware } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import type { DkgClient, DiscoveredSchema, IterationAttempt } from "../types.js";
import {
  createExecuteSparqlTool,
  createDiscoverClassesTool,
  createDiscoverPredicatesTool,
  createSampleDataTool,
} from "./tools/index.js";
import { generateSystemPrompt } from "./system-prompt.js";

export function createDkgQueryAgent(
  dkgClient: DkgClient,
  discoveredSchema: DiscoveredSchema,
  iterationHistory: IterationAttempt[]
): ReturnType<typeof createAgent> {
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

  const systemPrompt = generateSystemPrompt(discoveredSchema, iterationHistory);

  return createAgent({
    name: "dkg-query-generator",
    model,
    tools,
    systemPrompt,
    middleware: [toolCallLimitMiddleware({ runLimit: 10 })],
  });
}
