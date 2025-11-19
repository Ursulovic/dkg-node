import { tool } from "@langchain/core/tools";
import * as z from "zod";
import type { SectionTracker } from "../section-tracker";

/**
 * Creates a tool that allows the coordinator to interact with the section tracker.
 * The coordinator can get sections, mark them complete, and track progress.
 *
 * @param tracker - The section tracker instance
 * @returns LangChain tool for section tracking
 */
export function createSectionTrackerTool(tracker: SectionTracker) {
  return tool(
    async (input: { action: string; analysis?: string }) => {
      const { action, analysis } = input;

      switch (action) {
        case "get_next_section": {
          const section = tracker.getNextSection();
          if (!section) {
            return JSON.stringify({
              status: "complete",
              message: "All sections have been analyzed",
            });
          }

          return JSON.stringify({
            status: "success",
            section: {
              sectionIndex: section.sectionIndex,
              sectionTitle: section.sectionTitle,
              grokipediaChunk: section.grokipediaChunk,
              wikipediaChunk: section.wikipediaChunk,
              grokipediaLinks: section.grokipediaLinks,
              wikipediaLinks: section.wikipediaLinks,
              tokenEstimate: section.tokenEstimate,
            },
            progress: tracker.getProgress(),
          });
        }

        case "complete_section": {
          if (!analysis) {
            throw new Error(
              "analysis is required when completing a section",
            );
          }

          const currentSection = tracker.getNextSection();
          if (!currentSection) {
            return JSON.stringify({
              status: "error",
              message: "No section to complete - all sections already done",
            });
          }

          tracker.markSectionComplete(currentSection.sectionIndex);

          return JSON.stringify({
            status: "success",
            message: `Section ${currentSection.sectionIndex + 1} completed: "${currentSection.sectionTitle}"`,
            progress: tracker.getProgress(),
          });
        }

        case "get_progress": {
          const progress = tracker.getProgress();
          return JSON.stringify({
            status: "success",
            progress,
            isComplete: tracker.isComplete(),
          });
        }

        case "get_all_analyses": {
          if (!tracker.isComplete()) {
            return JSON.stringify({
              status: "error",
              message: "Cannot get all analyses - not all sections are complete yet",
            });
          }

          const analysesMap = tracker.getAllAnalyses();
          const analyses: string[] = [];

          for (const [_sectionIndex, agentMap] of analysesMap.entries()) {
            for (const [_agentName, analysis] of agentMap.entries()) {
              if (analysis) {
                analyses.push(analysis);
              }
            }
          }

          return JSON.stringify({
            status: "success",
            analyses,
            totalSections: tracker.getTotalSections(),
          });
        }

        default:
          throw new Error(
            `Unknown action: ${action}. Valid actions: get_next_section, complete_section, get_progress, get_all_analyses`,
          );
      }
    },
    {
      name: "section_tracker",
      description: `Manages cross-referenced sections for bias detection analysis. Use this tool to:
- get_next_section: Get the next section to analyze (includes full Grokipedia and Wikipedia content)
- complete_section: Mark the current section as complete with QA-approved analysis
- get_progress: Check how many sections are done and how many remain
- get_all_analyses: Get all completed analyses (only when all sections are done)`,
      schema: z.object({
        action: z
          .enum([
            "get_next_section",
            "complete_section",
            "get_progress",
            "get_all_analyses",
          ])
          .describe(
            "The action to perform: get_next_section | complete_section | get_progress | get_all_analyses",
          ),
        analysis: z
          .string()
          .optional()
          .describe(
            "Required when action=complete_section. The QA-approved bias analysis for the section.",
          ),
      }),
    },
  );
}
