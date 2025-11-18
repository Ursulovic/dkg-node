import chalk from "chalk";
import { createPineconeRetrieverTool } from "./tools/create-pinecone-retriever";
import { createTavilySearchTool } from "./tools/create-tavily-search";
import { createGoogleScholarTool } from "./tools/create-google-scholar";
import { createSubagentConfigs } from "./subagents";
import { COORDINATOR_PROMPT } from "./prompts/coordinator";
import { GrokipediaLoader } from "../loaders/grokipedia";
import { WikipediaLoader } from "../loaders/wikipedia";
import { PineconeRAG } from "../vectordb/pinecone";
import { createBiasDetectionCoordinator } from "./create-coordinator";
import type { BiasDetectionPromptVariables } from "./prompts/inject-variables";

export interface BiasDetectionOptions {
  grokipediaUrl: string;
  wikipediaUrl: string;
  maxIterations?: number;
  maxSubagentFollowups?: number;
  maxSubagentTasksPerFollowup?: number;
}

export async function detectBiasInGrokipediaPage(
  options: BiasDetectionOptions,
): Promise<string> {
  const {
    grokipediaUrl,
    wikipediaUrl,
    maxIterations = 200,
    maxSubagentFollowups = 1,
    maxSubagentTasksPerFollowup = 5,
  } = options;

  const promptVariables: BiasDetectionPromptVariables = {
    maxSubagentFollowups,
    maxSubagentTasksPerFollowup,
  };

  const rag = new PineconeRAG();

  const isGrokipediaIndexed = await rag.isIndexed(grokipediaUrl);
  if (!isGrokipediaIndexed) {
    const grokipediaLoader = new GrokipediaLoader();
    const grokipediaDocuments = await grokipediaLoader.loadPage(grokipediaUrl);
    console.log(
      chalk.gray(
        `✓ Grokipedia: ${grokipediaDocuments.length} document(s) loaded`,
      ),
    );
    await rag.upsert(grokipediaDocuments);
  } else {
    console.log(chalk.gray(`✓ Grokipedia: cached (already indexed)`));
  }

  const isWikipediaIndexed = await rag.isIndexed(wikipediaUrl);
  if (!isWikipediaIndexed) {
    const wikipediaLoader = new WikipediaLoader();
    const wikipediaDocuments = await wikipediaLoader.loadPage(wikipediaUrl);
    console.log(
      chalk.gray(
        `✓ Wikipedia: ${wikipediaDocuments.length} document(s) loaded\n`,
      ),
    );
    await rag.upsert(wikipediaDocuments);
  } else {
    console.log(chalk.gray(`✓ Wikipedia: cached (already indexed)\n`));
  }

  const pineconeRetriever = createPineconeRetrieverTool(
    grokipediaUrl,
    wikipediaUrl,
  );
  const tavilySearch = createTavilySearchTool();
  const googleScholar = createGoogleScholarTool();

  const subagents = createSubagentConfigs({
    pineconeRetriever,
    tavilySearch,
    googleScholar,
    promptVariables,
  });
  const { coordinator, callbackHandler } = createBiasDetectionCoordinator({
    subagents: subagents,
    coordinatorPrompt: COORDINATOR_PROMPT,
    model: "claude-sonnet-4-5-20250929",
    temperature: 0,
    promptVariables,
  });

  const result = await coordinator.invoke(
    {
      messages: [
        {
          role: "user",
          content: `Analyze the Grokipedia article at ${grokipediaUrl} for bias by comparing it with the Wikipedia article at ${wikipediaUrl}.

Coordinate your subagents to:
1. Verify factual accuracy (fact-checker)
2. Identify missing context (context-analyzer)
3. Validate sources and citations (source-verifier)

Synthesize their findings into a comprehensive bias report.`,
        },
      ],
    },
    {
      recursionLimit: maxIterations,
      callbacks: [callbackHandler],
    },
  );

  console.log(chalk.gray("\n" + "━".repeat(60)));
  console.log(chalk.green("✅ Bias detection completed successfully\n"));

  let markdownReport = "";

  if (result.messages && Array.isArray(result.messages)) {
    const lastMessage = result.messages[result.messages.length - 1];
    if (lastMessage && typeof lastMessage === "object") {
      const msg = lastMessage as { content?: string };
      if (msg.content && typeof msg.content === "string") {
        markdownReport = msg.content;
      }
    }
  }

  if (!markdownReport) {
    throw new Error(
      "No markdown report generated. The agent may not have completed the analysis.",
    );
  }

  return markdownReport;
}
