/**
 * Re-export CrossReferencedSection from summarizer
 * (defined there using Zod schema for validation)
 */
export type { CrossReferencedSection } from "./summarizer";

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
  tokenEstimate: number;
}

/**
 * Section with all analyses from all agents (for QA review)
 */
export interface SectionWithAnalyses {
  section: SectionContent;
  analyses: {
    "fact-checker"?: string;
    "context-analyzer"?: string;
    "source-verifier"?: string;
  };
}

/**
 * Agent names for type safety
 */
export type AgentName = "fact-checker" | "context-analyzer" | "source-verifier";

/**
 * Map of agent names to section indices that need revision
 */
export type RevisionMap = {
  [K in AgentName]?: number[];
};
