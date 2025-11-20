import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";
import z from "zod";

export const wikipediaSearchTool = new WikipediaQueryRun({
  topKResults: 7,
  maxDocContentLength: 5000,
}).asTool({
  name: "wikipedia_query",
  description: "Use when you want to query wikipedia with natural language",
  schema: z
    .string()
    .describe(
      "Search term to query wikipedia with, a simple question like 'What is the population of Ukraine as of 2024?' and not complex like 'When did Russia annex Crimea and which regions did it annex in 2022?' - this would be two questions like 'When did russia annex Crimea?' and 'Which regions did Russia annex?'. Be as specific as possible, questions can be longer to increase clarity BUT should ask only for ONE specific thing.",
    ),
});
