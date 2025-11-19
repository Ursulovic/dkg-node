import type { PipelineCallbacks } from "./types";

export function createPipelineLogger(): PipelineCallbacks {
  return {
    onCacheLoad: () => {
      console.log("📦 Loading from cache...");
    },
    onCacheLoaded: (sectionCount: number) => {
      console.log(`✓ Loaded ${sectionCount} sections from cache`);
    },
    onFetchStart: () => {
      console.log("Fetching pages...");
    },
    onFetchComplete: () => {
      console.log("✓ Fetched pages.");
    },
    onSimilarityComplete: () => {
      console.log("✓ Calculated similarity");
    },
    onSectionsStart: () => {
      console.log("Creating cross-referenced sections...");
    },
    onSectionsComplete: (sectionCount: number) => {
      console.log(`✓ Created ${sectionCount} cross-referenced sections`);
    },
    onCacheSaved: () => {
      console.log("💾 Cached summarizer output");
    },
    onAnalysisStart: (sectionCount: number) => {
      console.log(`Starting parallel analysis of ${sectionCount} sections...`);
    },
    onSectionAnalyzed: (index: number, total: number) => {
      console.log(`✓ Section ${index + 1}/${total} analyzed`);
    },
    onSectionAnalysisFailed: (index: number, error: Error) => {
      console.error(`❌ Failed to analyze section ${index}:`, error);
    },
    onAnalysisComplete: () => {
      console.log("✓ All sections analyzed");
    },
    onQAStart: () => {
      console.log("Starting QA review...");
    },
    onQAComplete: (needsRevision: boolean, revisionCount: number) => {
      if (needsRevision) {
        console.log(`✓ QA complete - ${revisionCount} sections need revision`);
      } else {
        console.log("✓ QA complete - all analyses approved");
      }
    },
    onRevisionsStart: (revisionCount: number) => {
      console.log(
        `Starting parallel revisions for ${revisionCount} sections...`,
      );
    },
    onRevisionMissingData: (index: number) => {
      console.warn(
        `⚠️ Missing previous analysis or feedback for section ${index}`,
      );
    },
    onSectionRevised: (index: number) => {
      console.log(`✓ Section ${index + 1} revision complete`);
    },
    onSectionRevisionFailed: (index: number, error: Error) => {
      console.error(`❌ Failed to revise section ${index}:`, error);
    },
    onRevisionsComplete: () => {
      console.log("✓ All revisions complete");
    },
    onSynthesisStart: () => {
      console.log("Synthesizing final report.");
    },
  };
}
