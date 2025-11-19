import { traceable } from "langsmith/traceable";
import { createTavilySearchTool } from "./tools/create-tavily-search";
import { createGoogleScholarTool } from "./tools/create-google-scholar";
import { GrokipediaLoader } from "../loaders/grokipedia";
import { WikipediaLoader } from "../loaders/wikipedia";
import { createBiasDetectionAgent } from "./create-bias-detection-agent";
import { createCrossReferencedSections } from "./summarizer";
import {
  computeSimilarity,
  summarizeSimilarity,
} from "../similarity/compute-similarity";
import { synthesizeBiasReport } from "./create-synthesizer";
import { ChatOpenAI } from "@langchain/openai";
import { cacheExists, readCache, writeCache } from "./summarizer-cache";
import type { PipelineCallbacks, CrossReferencedSection, SectionAnalysis } from "./types";
import { EventEmitter } from "events";

export interface BiasDetectionOptions {
  grokipediaUrl: string;
  wikipediaUrl: string;
  callbacks?: PipelineCallbacks;
}

export const detectBiasInGrokipediaPage = traceable(
  async (
    options: BiasDetectionOptions,
  ): Promise<{ markdown: string; jsonld: string }> => {
    const { grokipediaUrl, wikipediaUrl, callbacks = {} } = options;

    EventEmitter.defaultMaxListeners = 0;

    let sections: CrossReferencedSection[] | undefined;
    let similarityReport;

    if (await cacheExists(grokipediaUrl, wikipediaUrl)) {
      callbacks.onCacheLoad?.();
      const cached = await readCache(grokipediaUrl, wikipediaUrl);

      if (cached) {
        sections = cached.sections;
        similarityReport = cached.similarityReport;
        callbacks.onCacheLoaded?.(sections.length);
      }
    }

    if (!sections || !similarityReport) {
      callbacks.onFetchStart?.();
      const grokipediaLoader = new GrokipediaLoader();
      const wikipediaLoader = new WikipediaLoader();

      const grokipediaDocuments =
        await grokipediaLoader.loadPage(grokipediaUrl);
      const wikipediaDocuments = await wikipediaLoader.loadPage(wikipediaUrl);
      if (grokipediaDocuments.length === 0 || wikipediaDocuments.length === 0) {
        throw new Error("Failed to load one or both articles");
      }

      callbacks.onFetchComplete?.();

      similarityReport = await computeSimilarity(
        grokipediaDocuments[0]!,
        wikipediaDocuments[0]!,
      );

      callbacks.onSimilarityComplete?.();

      callbacks.onSectionsStart?.();

      sections = await createCrossReferencedSections(
        grokipediaDocuments[0]!.pageContent,
        wikipediaDocuments[0]!.pageContent,
        similarityReport,
      );

      callbacks.onSectionsComplete?.(sections.length);

      await writeCache(grokipediaUrl, wikipediaUrl, sections, similarityReport);
      callbacks.onCacheSaved?.();
    }

    const tavilySearch = createTavilySearchTool();
    const googleScholar = createGoogleScholarTool();

    const biasDetectionAgent = createBiasDetectionAgent({
      model: new ChatOpenAI({
        model: "gpt-4o-mini",
        temperature: 0,
      }),
      tavilySearch,
      googleScholar,
    });

    callbacks.onAnalysisStart?.(sections.length);

    const sectionAnalyses: SectionAnalysis[] = [];

    const analysisPromises = sections.map(async (section, index) => {
      try {
        const analysis = await biasDetectionAgent.analyze(index, {
          sectionIndex: section.sectionIndex,
          sectionTitle: section.sectionTitle,
          grokipediaChunk: section.grokipediaChunk,
          wikipediaChunk: section.wikipediaChunk,
          grokipediaLinks: section.grokipediaLinks,
          wikipediaLinks: section.wikipediaLinks,
          tasks: section.tasks,
        });

        sectionAnalyses.push({
          sectionIndex: index,
          sectionTitle: section.sectionTitle,
          analysis,
        });

        callbacks.onSectionAnalyzed?.(index, sections.length);
      } catch (error) {
        callbacks.onSectionAnalysisFailed?.(index, error as Error);

        sectionAnalyses.push({
          sectionIndex: index,
          sectionTitle: section.sectionTitle,
          analysis: `# Error\n\nAnalysis failed: ${(error as Error).message}`,
        });
      }
    });

    await Promise.allSettled(analysisPromises);
    callbacks.onAnalysisComplete?.();

    callbacks.onSynthesisStart?.();

    const synthesizerOutput = await synthesizeBiasReport(sectionAnalyses);

    const similaritySummary = summarizeSimilarity(similarityReport);
    const markdownReport = `${synthesizerOutput.markdown}\n\n---\n\n${similaritySummary}`;

    return { markdown: markdownReport, jsonld: synthesizerOutput.jsonld };
  },
  { name: "bias-detection" },
);
