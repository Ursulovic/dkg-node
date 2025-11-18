import chalk from "chalk";
import { getCurrentRunTree, traceable } from "langsmith/traceable";
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
import { summarizeGrokipediaArticle } from "./summarizer";

export interface BiasDetectionOptions {
  grokipediaUrl: string;
  wikipediaUrl: string;
  maxIterations?: number;
  maxSubagentFollowups?: number;
  maxSubagentTasksPerFollowup?: number;
}

export const detectBiasInGrokipediaPage = traceable(
  async (options: BiasDetectionOptions): Promise<string> => {
    const {
      grokipediaUrl,
      wikipediaUrl,
      maxIterations = 200,
      maxSubagentFollowups = 1,
      maxSubagentTasksPerFollowup = 5,
    } = options;

    const runTree = getCurrentRunTree();
    if (runTree) {
      runTree.tags = [...(runTree.tags ?? []), grokipediaUrl];
      runTree.metadata = {
        ...runTree.metadata,
        grokipediaUrl,
        wikipediaUrl,
      };
    }

    const promptVariables: BiasDetectionPromptVariables = {
      maxSubagentFollowups,
      maxSubagentTasksPerFollowup,
    };

    const rag = new PineconeRAG();

    const grokipediaLoader = new GrokipediaLoader();
    const grokipediaDocuments = await grokipediaLoader.loadPage(grokipediaUrl);
    console.log(
      chalk.gray(
        `✓ Grokipedia: ${grokipediaDocuments.length} document(s) loaded`,
      ),
    );

    const wikipediaLoader = new WikipediaLoader();
    const wikipediaDocuments = await wikipediaLoader.loadPage(wikipediaUrl);
    console.log(
      chalk.gray(
        `✓ Wikipedia: ${wikipediaDocuments.length} document(s) loaded`,
      ),
    );

    const isGrokipediaIndexed = await rag.isIndexed(grokipediaUrl);
    const isWikipediaIndexed = await rag.isIndexed(wikipediaUrl);

    const documentsToIndex = [
      ...(isGrokipediaIndexed ? [] : grokipediaDocuments),
      ...(isWikipediaIndexed ? [] : wikipediaDocuments),
    ];

    if (documentsToIndex.length > 0) {
      await rag.upsert(documentsToIndex);
      console.log(
        chalk.gray(`✓ Indexed ${documentsToIndex.length} document(s)`),
      );
    } else {
      console.log(chalk.gray(`✓ All documents already indexed (cached)`));
    }

    if (grokipediaDocuments.length === 0) {
      throw new Error("No Grokipedia documents loaded");
    }
    console.log(chalk.gray("\nGenerating article summary with Gemini..."));
    const summary = await summarizeGrokipediaArticle(
      grokipediaDocuments[0]!.pageContent,
    );
    console.log(chalk.gray("✓ Summary generated\n"));

    const pineconeRetriever = createPineconeRetrieverTool(
      grokipediaUrl,
      wikipediaUrl,
    );
    const tavilySearch = createTavilySearchTool();
    const googleScholar = createGoogleScholarTool();

    const subagents = createSubagentConfigs({
      pineconeRetriever,
      tavilySearch,
      googleScholar: googleScholar,
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
            content: `Analyze the Grokipedia article for bias by comparing it with Wikipedia.

Here is the structured summary of the Grokipedia article:

${summary}

Use the section-based sequential workflow:
1. Process each section sequentially
2. For each section, spawn fact-checker, context-analyzer, and source-verifier
3. Handle followups
4. Use quality-assurance to assess work quality
5. If RETRY_ONCE, provide targeted feedback for refinement
6. After all sections, synthesize comprehensive bias report

Compare findings against Wikipedia (indexed in Pinecone).`,
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
  },
  { name: "bias-detection" },
);
