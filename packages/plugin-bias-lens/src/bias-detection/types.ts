/**
 * Re-export CrossReferencedSection from summarizer
 * (defined there using Zod schema for validation)
 */
export type { CrossReferencedSection } from "./summarizer";

/**
 * Section analysis result with metadata
 */
export interface SectionAnalysis {
  sectionIndex: number;
  sectionTitle: string;
  analysis: string;
}

/**
 * Metadata about a section without the full content
 * Used for coordinator to track progress without consuming tokens
 */
export interface SectionMetadata {
  sectionIndex: number;
  sectionTitle: string;
  totalSections: number;
}

/**
 * Progress tracking for section analysis
 */
export interface SectionProgress {
  current: number;
  total: number;
  completed: number;
}

/**
 * QA feedback for a specific agent on a specific section
 */
export interface QAFeedback {
  /** What the agent did well (for reference during revision) */
  whatWasGood: string;
  /** What needs improvement (specific tasks for revision) */
  whatNeedsImprovement: string;
  /** Specific claims, topics, or citations to address */
  specificTasks: string[];
}

/**
 * Section content without analysis (for subagents)
 */
export interface SectionContent {
  sectionIndex: number;
  sectionTitle: string;
  grokipediaChunk: string;
  wikipediaChunk: string;
  grokipediaLinks: string[];
  wikipediaLinks: string[];
  tasks: Array<{
    claim: string;
    relevantLinks: string[];
  }>;
}

/**
 * Section with analysis from bias detection agent (for QA review)
 */
export interface SectionWithAnalyses {
  section: SectionContent;
  analysis: string | undefined; // Single comprehensive analysis from bias-detection-agent
}

/**
 * Agent names for type safety
 */
export type AgentName = "bias-detection-agent";

/**
 * Pipeline phases
 */
export type PipelinePhase =
  | "initial_analysis"
  | "awaiting_qa"
  | "revisions"
  | "complete";

/**
 * Pipeline status returned by get_status tool
 */
export interface PipelineStatus {
  phase: PipelinePhase;
  totalSections: number;
  analyzedSections: number;
  sectionsNeedingFeedback: number[];
  nextSectionToAnalyze: number | null;
  nextSectionForFeedback: number | null;
  progress: string;
}

/**
 * Pipeline logging callbacks for progress tracking and observability
 */
export interface PipelineCallbacks {
  onCacheLoad?: () => void;
  onCacheLoaded?: (sectionCount: number) => void;
  onFetchStart?: () => void;
  onFetchComplete?: () => void;
  onSimilarityComplete?: () => void;
  onSectionsStart?: () => void;
  onSectionsComplete?: (sectionCount: number) => void;
  onCacheSaved?: () => void;
  onAnalysisStart?: (sectionCount: number) => void;
  onSectionAnalyzed?: (index: number, total: number) => void;
  onSectionAnalysisFailed?: (index: number, error: Error) => void;
  onAnalysisComplete?: () => void;
  onQAStart?: () => void;
  onQAComplete?: (needsRevision: boolean, revisionCount: number) => void;
  onRevisionsStart?: (revisionCount: number) => void;
  onRevisionMissingData?: (index: number) => void;
  onSectionRevised?: (index: number) => void;
  onSectionRevisionFailed?: (index: number, error: Error) => void;
  onRevisionsComplete?: () => void;
  onSynthesisStart?: () => void;
}
