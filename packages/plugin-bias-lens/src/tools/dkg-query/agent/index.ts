import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { traceable } from "langsmith/traceable";
import type { DkgClient, DkgQueryInput, DkgQueryResult } from "../types.js";
import {
  createSearchClassesTool,
  createDiscoverPredicatesTool,
  createExecuteSparqlTool,
  createListPopularClassesTool,
} from "./tools/index.js";
import { SYSTEM_PROMPT } from "./system-prompt.js";

export const createDkgQueryAgent = (dkgClient: DkgClient) => {
  const tools = [
    createSearchClassesTool(dkgClient),
    createDiscoverPredicatesTool(dkgClient),
    createExecuteSparqlTool(dkgClient),
    createListPopularClassesTool(dkgClient),
  ];

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0,
  });

  return createReactAgent({
    llm: model,
    tools,
    messageModifier: SYSTEM_PROMPT,
  });
};

export const runDkgQueryAgent = traceable(
  async (input: DkgQueryInput, dkgClient: DkgClient): Promise<DkgQueryResult> => {
    const agent = createDkgQueryAgent(dkgClient);

    const result = await agent.invoke({
      messages: [{ role: "user", content: input.query }],
    });

    const lastMessage = result.messages[result.messages.length - 1];
    if (!lastMessage) {
      return {
        success: false,
        data: [],
        sparqlUsed: "",
        error: "No response from agent",
      };
    }

    const content =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    const sparqlMatch = content.match(/```sparql\n([\s\S]*?)\n```/);
    const sparqlUsed = sparqlMatch?.[1] ?? "";

    return {
      success: true,
      data: [],
      sparqlUsed,
      answer: content,
    };
  },
  {
    name: "dkg-query",
    run_type: "chain",
    processInputs: (inputs) => {
      const args = inputs as unknown as { args: [DkgQueryInput, DkgClient] };
      return { query: args.args[0]?.query };
    },
    processOutputs: (outputs) => {
      const result = outputs as DkgQueryResult & { answer?: string };
      return {
        success: result.success,
        answer: result.answer,
      };
    },
  }
);
