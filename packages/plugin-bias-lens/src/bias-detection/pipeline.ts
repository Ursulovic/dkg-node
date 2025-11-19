import { traceable } from "langsmith/traceable";
import { createTavilySearchTool } from "./tools/create-tavily-search";
import { createGoogleScholarTool } from "./tools/create-google-scholar";
import { createCoordinatorTrackerTool } from "./tools/create-coordinator-tracker-tool";
import { createSubagentTools } from "./subagents";
import { COORDINATOR_PROMPT } from "./prompts/coordinator";
import { GrokipediaLoader } from "../loaders/grokipedia";
import { WikipediaLoader } from "../loaders/wikipedia";
import { createBiasDetectionCoordinator } from "./create-coordinator";
import { createCrossReferencedSections } from "./summarizer";
import { SectionTracker } from "./section-tracker";
import {
  computeSimilarity,
  summarizeSimilarity,
} from "../similarity/compute-similarity";
import { synthesizeBiasReport } from "./create-synthesizer";

export interface BiasDetectionOptions {
  grokipediaUrl: string;
  wikipediaUrl: string;
  maxIterations?: number;
}

export const detectBiasInGrokipediaPage = traceable(
  async (
    options: BiasDetectionOptions,
  ): Promise<{ markdown: string; jsonld: string }> => {
    const { grokipediaUrl, wikipediaUrl, maxIterations = 200 } = options;

    const grokipediaLoader = new GrokipediaLoader();
    const wikipediaLoader = new WikipediaLoader();

    const grokipediaDocuments = await grokipediaLoader.loadPage(grokipediaUrl);
    const wikipediaDocuments = await wikipediaLoader.loadPage(wikipediaUrl);
    if (grokipediaDocuments.length === 0 || wikipediaDocuments.length === 0) {
      throw new Error("Failed to load one or both articles");
    }

    console.log("Fetched pages.");

    const similarityReport = await computeSimilarity(
      grokipediaDocuments[0]!,
      wikipediaDocuments[0]!,
    );

    console.log("Calculated similarity");

    console.log("Starting agents.");

    const sections = await createCrossReferencedSections(
      grokipediaDocuments[0]!.pageContent,
      wikipediaDocuments[0]!.pageContent,
      similarityReport,
    );

    const sectionTracker = new SectionTracker();
    sectionTracker.initializeSections(sections);

    const coordinatorTrackerTool = createCoordinatorTrackerTool(sectionTracker);

    const tavilySearch = createTavilySearchTool();
    const googleScholar = createGoogleScholarTool();

    const subagentTools = createSubagentTools({
      sectionTracker,
      tavilySearch,
      googleScholar,
    });

    const coordinator = createBiasDetectionCoordinator({
      subagentTools: [
        subagentTools.callFactChecker,
        subagentTools.callContextAnalyzer,
        subagentTools.callSourceVerifier,
        subagentTools.callQualityAssurance,
      ] as any,
      coordinatorPrompt: COORDINATOR_PROMPT,
      model: "claude-sonnet-4-5-20250929",
      tools: [coordinatorTrackerTool as any],
    });

    await coordinator.invoke(
      {
        messages: [
          {
            role: "user",
            content: `Orchestrate bias detection analysis using the 3-phase workflow.

**Phase 1: Initial Analysis**
- For each section, call coordinator_tracker(action="get_next_section_metadata")
- Delegate to fact-checker, context-analyzer, source-verifier (they fetch content via section_reader)
- Call coordinator_tracker(action="mark_section_complete")
- Repeat until all sections analyzed

**Phase 2: Quality Assurance**
- Call coordinator_tracker(action="start_qa_phase")
- Delegate to quality-assurance for batch review
- Call coordinator_tracker(action="get_revision_map")

**Phase 3: Revisions (if needed)**
- If revision map has sections, delegate revisions to appropriate agents
- Agents use section_reader to fetch content + previous analysis + QA feedback

**Important:**
- You ONLY see metadata (section numbers/titles), never full content
- Agents fetch content themselves using section_reader
- Do NOT synthesize final report - that's done by separate synthesizer

Begin with Phase 1.`,
          },
        ],
      },
      { recursionLimit: maxIterations },
    );

    const synthesizerOutput = await synthesizeBiasReport(sectionTracker);

    const similaritySummary = summarizeSimilarity(similarityReport);
    const markdownReport = `${synthesizerOutput.markdown}\n\n---\n\n${similaritySummary}`;

    return { markdown: markdownReport, jsonld: synthesizerOutput.jsonld };
  },
  { name: "bias-detection" },
);
