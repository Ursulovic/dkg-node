import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { WikidataVectorStore } from "../../vectordb/store.js";

const vectorSearchSchema = z
  .object({
    query: z
      .string()
      .describe(
        "Search query to find relevant Wikidata properties, entity types, or constraints",
      ),
    type: z
      .enum(["property", "entity-type", "constraint", "all"])
      .describe("Type of documents to search for"),
  })
  .required();

export function createVectorSearchTool(vectorStore: WikidataVectorStore) {
  return new DynamicStructuredTool({
    name: "search_wikidata_vector_store",
    description:
      "Search the Wikidata vector store for relevant properties, entity types, or constraints. Use this to find the right Wikidata properties (P-codes) and entity types (Q-codes) needed to construct SPARQL queries.",
    schema: vectorSearchSchema,
    func: async ({ query, type }) => {
      if (type === "all") {
        const results = await vectorStore.search(query, 20);
        return JSON.stringify(
          results.map((doc) => ({
            type: doc.metadata.type,
            id: doc.metadata.id,
            label: doc.metadata.label,
            description: doc.metadata.description,
            content: doc.pageContent,
          })),
        );
      }

      const results = await vectorStore.searchByType(query, type, 20);
      return JSON.stringify(
        results.map((doc) => ({
          type: doc.metadata.type,
          id: doc.metadata.id,
          label: doc.metadata.label,
          description: doc.metadata.description,
          content: doc.pageContent,
        })),
      );
    },
  });
}
