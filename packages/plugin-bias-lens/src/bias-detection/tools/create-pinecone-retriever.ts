import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { PineconeRAG } from "../../vectordb/pinecone";

export function createPineconeRetrieverTool(
  grokipediaUrl: string,
  wikipediaUrl: string,
) {
  const rag = new PineconeRAG();

  return tool(
    async ({ query, sourceType, maxResults = 5 }) => {
      const sourceUrl =
        sourceType === "grokipedia" ? grokipediaUrl : wikipediaUrl;

      try {
        const documents = await rag.retrieve(query, {
          k: maxResults,
          filter: { source: sourceUrl },
        });

        if (documents.length === 0) {
          return `No documents found in ${sourceType} for query: "${query}". This might mean the content hasn't been indexed yet.`;
        }

        const formattedDocs = documents
          .map((doc, idx) => {
            const metadata = doc.metadata;
            return `
Document ${idx + 1}:
Source: ${metadata.source || "Unknown"}
${metadata.title ? `Title: ${metadata.title}\n` : ""}Content: ${doc.pageContent}
---`;
          })
          .join("\n");

        return `Found ${documents.length} relevant document(s) from ${sourceType}:\n\n${formattedDocs}`;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return `Error retrieving documents from ${sourceType}: ${errorMessage}`;
      }
    },
    {
      name: "retrieve_from_pinecone",
      description:
        "Search the Pinecone vector database for relevant content from either Grokipedia or Wikipedia articles. " +
        "Use this to retrieve specific information about claims, context, or sources mentioned in the articles. " +
        "You can query both sources separately to compare content.",
      schema: z.object({
        query: z
          .string()
          .describe(
            "The search query to find relevant content. Be specific about what you're looking for (e.g., 'climate change statistics', 'methodology section', 'author citations')",
          ),
        sourceType: z
          .enum(["grokipedia", "wikipedia"])
          .describe(
            "Which source to retrieve from: 'grokipedia' for the Grokipedia article or 'wikipedia' for the Wikipedia article",
          ),
        maxResults: z
          .number()
          .optional()
          .default(5)
          .describe(
            "Maximum number of relevant documents to return (default: 5)",
          ),
      }),
    },
  );
}
