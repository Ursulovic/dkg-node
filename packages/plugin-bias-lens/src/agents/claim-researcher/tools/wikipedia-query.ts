import { WikipediaQueryRun } from "@langchain/community/tools/wikipedia_query_run";
import z from "zod";

export const wikipediaSearchTool = new WikipediaQueryRun({
  topKResults: 5,
  maxDocContentLength: 4000,
}).asTool({
  name: "wikipedia_query",
  description:
    "Query Wikipedia for encyclopedia facts and general knowledge. Use for: dates, definitions, historical facts, population data, organizational info. Ask ONE specific question (not compound questions). Returns: Wikipedia article content matching your query.",
  schema: z
    .string()
    .describe(
      "A simple, specific question like 'What is the population of Tokyo?' - NOT compound questions. Ask for ONE thing only.",
    ),
});
