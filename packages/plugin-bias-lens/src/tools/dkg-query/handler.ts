import { StringOutputParser } from "@langchain/core/output_parsers";
import type { DkgClient, DkgQueryInput, DkgQueryResult } from "./types.js";
import { createDkgQueryAgent } from "./agent/index.js";

export async function dkgQueryHandler(
  input: DkgQueryInput,
  dkgClient: DkgClient
): Promise<DkgQueryResult> {
  try {
    const agent = await createDkgQueryAgent(dkgClient);

    const state = await agent.invoke({
      messages: [{ role: "user", content: input.query }],
    });

    const parser = new StringOutputParser();
    const messages = state.messages;
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage) {
      return {
        success: false,
        data: [],
        sparqlUsed: "",
        error: "No response from agent",
      };
    }

    const response = await parser.invoke(lastMessage);

    const sparqlMatch = response.match(/sparqlUsed["']?\s*:\s*["']([^"']+)["']/);
    const sparqlUsed = sparqlMatch?.[1] ?? "";

    const dataMatch = response.match(/"data"\s*:\s*(\[[^\]]*\])/);
    let data: Record<string, unknown>[] = [];
    if (dataMatch?.[1]) {
      try {
        data = JSON.parse(dataMatch[1]);
      } catch {
        data = [];
      }
    }

    const successMatch = response.match(/"success"\s*:\s*(true|false)/);
    const success = successMatch?.[1] === "true" || !response.includes("error");
    const error = success ? undefined : extractError(response);

    return {
      success,
      data,
      sparqlUsed,
      error,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      sparqlUsed: "",
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}

function extractError(response: string): string | undefined {
  const errorMatch = response.match(/"error"\s*:\s*["']([^"']+)["']/);
  if (errorMatch?.[1]) {
    return errorMatch[1];
  }

  if (response.includes("no results")) {
    return "Query returned no results";
  }

  if (response.includes("failed")) {
    return "Query execution failed";
  }

  return undefined;
}
