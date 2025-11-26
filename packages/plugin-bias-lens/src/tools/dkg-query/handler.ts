import { traceable } from "langsmith/traceable";
import type { BaseMessage } from "@langchain/core/messages";
import type {
  DkgClient,
  DkgQueryInput,
  DkgQueryResult,
  DiscoveredSchema,
  IterationAttempt,
  ClassInfo,
  PredicateInfo,
} from "./types.js";
import { createDkgQueryAgent } from "./agent/index.js";

const MAX_ITERATIONS = 3;

async function discoverInitialSchema(dkgClient: DkgClient): Promise<DiscoveredSchema> {
  const schema: DiscoveredSchema = { classes: [], predicates: [], samples: [] };

  try {
    const classQuery = `
      PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
      SELECT DISTINCT ?type (COUNT(?type) as ?count) WHERE {
        GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
        GRAPH ?kaGraph { ?s a ?type . }
      } GROUP BY ?type ORDER BY DESC(?count) LIMIT 15
    `;
    const classResult = await dkgClient.graph.query(classQuery, "SELECT");
    schema.classes = classResult.data.map((row) => ({
      type: String(row.type),
      count: Number(row.count) || 0,
    }));

    const topClass = schema.classes[0];
    if (topClass) {
      const predicateQuery = `
        PREFIX dkg: <https://ontology.origintrail.io/dkg/1.0#>
        SELECT DISTINCT ?predicate (COUNT(?predicate) as ?count) WHERE {
          GRAPH <current:graph> { ?g dkg:hasNamedGraph ?kaGraph . }
          GRAPH ?kaGraph { ?s a <${topClass.type}> . ?s ?predicate ?o . }
        } GROUP BY ?predicate ORDER BY DESC(?count) LIMIT 15
      `;
      const predicateResult = await dkgClient.graph.query(predicateQuery, "SELECT");
      schema.predicates = predicateResult.data.map((row) => ({
        predicate: String(row.predicate),
        count: Number(row.count) || 0,
      }));
    }
  } catch {
    // Discovery failed, continue with empty schema
  }

  return schema;
}

interface ToolResult {
  success: boolean;
  data: Record<string, unknown>[];
  sparqlUsed: string;
  count: number;
  error?: string;
}

function extractResultFromToolMessages(messages: BaseMessage[]): ToolResult | null {
  for (const msg of messages) {
    if (msg._getType() !== "tool") continue;

    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

    try {
      const parsed = JSON.parse(content) as Partial<ToolResult>;

      if (parsed.success && typeof parsed.count === "number" && parsed.count > 0) {
        return {
          success: true,
          data: Array.isArray(parsed.data) ? parsed.data : [],
          sparqlUsed: typeof parsed.sparqlUsed === "string" ? parsed.sparqlUsed : "",
          count: parsed.count,
        };
      }

      if (parsed.sparqlUsed) {
        return {
          success: parsed.success ?? false,
          data: Array.isArray(parsed.data) ? parsed.data : [],
          sparqlUsed: parsed.sparqlUsed,
          count: parsed.count ?? 0,
          error: typeof parsed.error === "string" ? parsed.error : undefined,
        };
      }
    } catch {
      // Not JSON, continue to next message
    }
  }

  return null;
}

function mergeDiscoveries(
  schema: DiscoveredSchema,
  newClasses: ClassInfo[],
  newPredicates: PredicateInfo[]
): void {
  const existingClassTypes = new Set(schema.classes.map((c) => c.type));
  for (const cls of newClasses) {
    if (!existingClassTypes.has(cls.type)) {
      schema.classes.push(cls);
    }
  }

  const existingPredicates = new Set(schema.predicates.map((p) => p.predicate));
  for (const pred of newPredicates) {
    if (!existingPredicates.has(pred.predicate)) {
      schema.predicates.push(pred);
    }
  }
}

function extractDiscoveriesFromMessages(
  messages: BaseMessage[],
  schema: DiscoveredSchema
): string[] {
  const discoveries: string[] = [];

  for (const msg of messages) {
    const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);

    if (content.includes("discover_classes") || content.includes('"type"')) {
      const classMatches = content.matchAll(/"type"\s*:\s*"([^"]+)"/g);
      for (const match of classMatches) {
        const typeValue = match[1];
        if (typeValue && typeValue.startsWith("http")) {
          discoveries.push(typeValue);
          mergeDiscoveries(schema, [{ type: typeValue, count: 0 }], []);
        }
      }
    }

    if (content.includes("discover_predicates") || content.includes('"predicate"')) {
      const predMatches = content.matchAll(/"predicate"\s*:\s*"([^"]+)"/g);
      for (const match of predMatches) {
        const predValue = match[1];
        if (predValue && predValue.startsWith("http")) {
          discoveries.push(predValue);
          mergeDiscoveries(schema, [], [{ predicate: predValue }]);
        }
      }
    }
  }

  return discoveries;
}

async function dkgQueryHandlerImpl(
  input: DkgQueryInput,
  dkgClient: DkgClient
): Promise<DkgQueryResult> {
  try {
    const schema = await discoverInitialSchema(dkgClient);
    const iterationHistory: IterationAttempt[] = [];

    for (let iteration = 1; iteration <= MAX_ITERATIONS; iteration++) {
      const agent = createDkgQueryAgent(dkgClient, schema, iterationHistory);

      const state = await agent.invoke({
        messages: [{ role: "user", content: input.query }],
      });

      const messages = state.messages as BaseMessage[];

      if (!messages || messages.length === 0) {
        iterationHistory.push({
          iteration,
          sparqlAttempted: "",
          error: "No response from agent",
        });
        continue;
      }

      const toolResult = extractResultFromToolMessages(messages);

      if (toolResult?.success && toolResult.count > 0) {
        return {
          success: true,
          data: toolResult.data,
          sparqlUsed: toolResult.sparqlUsed,
        };
      }

      const discoveries = extractDiscoveriesFromMessages(messages, schema);

      iterationHistory.push({
        iteration,
        sparqlAttempted: toolResult?.sparqlUsed || "unknown",
        error: toolResult?.error,
        resultCount: toolResult?.count ?? 0,
        discoveries: discoveries.length > 0 ? discoveries : undefined,
      });

      if (iteration === MAX_ITERATIONS) {
        return {
          success: false,
          data: toolResult?.data || [],
          sparqlUsed: toolResult?.sparqlUsed || "",
          error:
            toolResult?.error ||
            `Query returned ${toolResult?.count ?? 0} results after ${MAX_ITERATIONS} attempts`,
        };
      }
    }

    return {
      success: false,
      data: [],
      sparqlUsed: "",
      error: "Max iterations reached without successful result",
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

export const dkgQueryHandler = traceable(dkgQueryHandlerImpl, {
  name: "dkg-query",
  run_type: "chain",
});
