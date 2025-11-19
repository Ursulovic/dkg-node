import type {
  CrossReferencedSection,
  SectionMetadata,
  SectionProgress,
  QAFeedback,
  SectionContent,
  SectionWithAnalyses,
  AgentName,
  RevisionMap,
} from "./types";

/**
 * Tracks progress through cross-referenced sections during bias analysis.
 * Maintains state in memory and provides sections to agents with minimal access.
 *
 * Architecture:
 * - Coordinator: metadata-only access (no content, no analyses)
 * - Subagents: content + analysis access (read/write their own analyses)
 * - QA: batch access (all sections + analyses, write feedback)
 * - Synthesizer: read-only access to all analyses
 */
export class SectionTracker {
  private sections: CrossReferencedSection[] = [];
  private currentIndex: number = 0;
  private completedSections: Set<number> = new Set(); // Just tracking completion
  private sectionAnalyses: Map<number, Map<AgentName, string>> = new Map(); // sectionIndex → agentName → analysis
  private qaFeedback: Map<number, Map<AgentName, QAFeedback>> = new Map(); // sectionIndex → agentName → feedback

  /**
   * Initialize the tracker with cross-referenced sections
   *
   * @param sections - Array of sections created by the summarization agent
   */
  initializeSections(sections: CrossReferencedSection[]): void {
    if (!sections || sections.length === 0) {
      throw new Error("Cannot initialize tracker with empty sections array");
    }

    this.sections = sections;
    this.currentIndex = 0;
    this.completedSections.clear();

    console.log(
      `📋 Section tracker initialized with ${sections.length} sections`,
    );
  }

  /**
   * Get the next section to analyze
   *
   * @returns The next unanalyzed section, or null if all sections are complete
   */
  getNextSection(): CrossReferencedSection | null {
    if (this.currentIndex >= this.sections.length) {
      return null; // All sections completed
    }

    return this.sections[this.currentIndex]!;
  }

  /**
   * Get metadata about the current section without full content
   * Used by coordinator to track progress without consuming tokens
   *
   * @returns Section metadata or null if all complete
   */
  getCurrentSectionMetadata(): SectionMetadata | null {
    const section = this.getNextSection();
    if (!section) {
      return null;
    }

    return {
      sectionIndex: section.sectionIndex,
      sectionTitle: section.sectionTitle,
      totalSections: this.sections.length,
    };
  }

  /**
   * Mark a section as complete (coordinator only)
   * Does NOT store analysis - analyses are stored by subagents directly
   *
   * @param sectionIndex - Index of the section being completed
   */
  markSectionComplete(sectionIndex: number): void {
    if (sectionIndex !== this.currentIndex) {
      throw new Error(
        `Cannot complete section ${sectionIndex}. Current section is ${this.currentIndex}. Sections must be completed sequentially.`,
      );
    }

    if (this.completedSections.has(sectionIndex)) {
      throw new Error(`Section ${sectionIndex} is already marked as complete`);
    }

    this.completedSections.add(sectionIndex);
    this.currentIndex++;

    console.log(
      `✓ Section ${sectionIndex + 1}/${this.sections.length} completed: "${this.sections[sectionIndex]?.sectionTitle}"`,
    );
  }

  /**
   * Get progress information
   *
   * @returns Current progress through the sections
   */
  getProgress(): SectionProgress {
    return {
      current: this.currentIndex,
      total: this.sections.length,
      completed: this.completedSections.size,
    };
  }

  // ===== CONTENT ACCESS (for subagents) =====

  /**
   * Get section content by index (for subagents)
   *
   * @param sectionIndex - Index of the section to retrieve
   * @returns Section content without analyses
   */
  getSectionContent(sectionIndex: number): SectionContent {
    const section = this.sections[sectionIndex];
    if (!section) {
      throw new Error(`Section ${sectionIndex} does not exist`);
    }

    return {
      sectionIndex: section.sectionIndex,
      sectionTitle: section.sectionTitle,
      grokipediaChunk: section.grokipediaChunk,
      wikipediaChunk: section.wikipediaChunk,
      grokipediaLinks: section.grokipediaLinks,
      wikipediaLinks: section.wikipediaLinks,
      tokenEstimate: section.tokenEstimate,
    };
  }

  /**
   * Save analysis for a specific section and agent (subagents write)
   *
   * @param sectionIndex - Index of the section
   * @param agentName - Name of the agent saving the analysis
   * @param analysis - The analysis text
   */
  saveAnalysis(sectionIndex: number, agentName: AgentName, analysis: string): void {
    if (!this.sections[sectionIndex]) {
      throw new Error(`Section ${sectionIndex} does not exist`);
    }

    if (!this.sectionAnalyses.has(sectionIndex)) {
      this.sectionAnalyses.set(sectionIndex, new Map());
    }

    const sectionMap = this.sectionAnalyses.get(sectionIndex)!;
    sectionMap.set(agentName, analysis);

    console.log(
      `💾 ${agentName} analysis saved for section ${sectionIndex}: "${this.sections[sectionIndex]!.sectionTitle}"`,
    );
  }

  /**
   * Get previous analysis for a specific section and agent (for revisions)
   *
   * @param sectionIndex - Index of the section
   * @param agentName - Name of the agent
   * @returns Previous analysis or null if none exists
   */
  getAnalysis(sectionIndex: number, agentName: AgentName): string | null {
    const sectionMap = this.sectionAnalyses.get(sectionIndex);
    if (!sectionMap) {
      return null;
    }
    return sectionMap.get(agentName) ?? null;
  }

  /**
   * Get QA feedback for a specific section and agent (for revisions)
   *
   * @param sectionIndex - Index of the section
   * @param agentName - Name of the agent
   * @returns QA feedback or null if none exists
   */
  getQAFeedback(sectionIndex: number, agentName: AgentName): QAFeedback | null {
    const sectionMap = this.qaFeedback.get(sectionIndex);
    if (!sectionMap) {
      return null;
    }
    return sectionMap.get(agentName) ?? null;
  }

  // ===== BATCH ACCESS (for QA agent) =====

  /**
   * Get all sections with all analyses (for QA batch review)
   *
   * @returns Array of sections with their analyses
   */
  getAllSectionsWithAnalyses(): SectionWithAnalyses[] {
    return this.sections.map((section, index) => {
      const analysesMap = this.sectionAnalyses.get(index);
      return {
        section: this.getSectionContent(index),
        analyses: {
          "fact-checker": analysesMap?.get("fact-checker"),
          "context-analyzer": analysesMap?.get("context-analyzer"),
          "source-verifier": analysesMap?.get("source-verifier"),
        },
      };
    });
  }

  /**
   * Save QA feedback for a specific section and agent (QA writes)
   *
   * @param sectionIndex - Index of the section
   * @param agentName - Name of the agent receiving feedback
   * @param feedback - The QA feedback
   */
  saveQAFeedback(
    sectionIndex: number,
    agentName: AgentName,
    feedback: QAFeedback,
  ): void {
    if (!this.sections[sectionIndex]) {
      throw new Error(`Section ${sectionIndex} does not exist`);
    }

    if (!this.qaFeedback.has(sectionIndex)) {
      this.qaFeedback.set(sectionIndex, new Map());
    }

    const sectionMap = this.qaFeedback.get(sectionIndex)!;
    sectionMap.set(agentName, feedback);

    console.log(
      `📝 QA feedback saved for ${agentName} on section ${sectionIndex}`,
    );
  }

  /**
   * Get all metadata for sections (coordinator access)
   *
   * @returns Array of section metadata
   */
  getAllSectionMetadata(): SectionMetadata[] {
    return this.sections.map((section) => ({
      sectionIndex: section.sectionIndex,
      sectionTitle: section.sectionTitle,
      totalSections: this.sections.length,
    }));
  }

  /**
   * Get revision map (which sections each agent should revisit)
   *
   * @returns Map of agent names to section indices needing revision
   */
  getRevisionMap(): RevisionMap {
    const revisionMap: RevisionMap = {};

    for (const [sectionIndex, feedbackMap] of this.qaFeedback.entries()) {
      for (const [agentName, _feedback] of feedbackMap.entries()) {
        if (!revisionMap[agentName]) {
          revisionMap[agentName] = [];
        }
        revisionMap[agentName]!.push(sectionIndex);
      }
    }

    return revisionMap;
  }

  // ===== SYNTHESIS ACCESS (for synthesizer agent) =====

  /**
   * Get all analyses for all sections (for final report synthesis)
   *
   * @returns Map of sectionIndex to Map of agentName to analysis
   */
  getAllAnalyses(): Map<number, Map<AgentName, string>> {
    return new Map(this.sectionAnalyses);
  }

  /**
   * Check if all sections are complete
   *
   * @returns True if all sections have been analyzed
   */
  isComplete(): boolean {
    return this.currentIndex >= this.sections.length;
  }

  /**
   * Reset the tracker (for testing or restarting analysis)
   */
  reset(): void {
    this.currentIndex = 0;
    this.completedSections.clear();
    this.sectionAnalyses.clear();
    this.qaFeedback.clear();
  }

  /**
   * Get total number of sections
   */
  getTotalSections(): number {
    return this.sections.length;
  }
}
