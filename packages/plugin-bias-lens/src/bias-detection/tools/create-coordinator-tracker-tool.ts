import { tool } from "@langchain/core/tools";
import * as z from "zod";
import type { SectionTracker } from "../section-tracker";

/**
 * Creates a metadata-only tool for the coordinator.
 * The coordinator can ONLY see section numbers and titles, never full content or analyses.
 * This saves massive amounts of tokens.
 *
 * @param tracker - The section tracker instance
 * @returns LangChain tool for coordinator workflow management
 */
export function createCoordinatorTrackerTool(tracker: SectionTracker) {
  return tool(
    async (input: { action: string }) => {
      const { action } = input;

      switch (action) {
        case "get_next_section_metadata": {
          const metadata = tracker.getCurrentSectionMetadata();
          if (!metadata) {
            return JSON.stringify({
              status: "complete",
              message: "All sections have been analyzed",
            });
          }

          return JSON.stringify({
            status: "success",
            sectionIndex: metadata.sectionIndex,
            sectionTitle: metadata.sectionTitle,
            progress: tracker.getProgress(),
          });
        }

        case "mark_section_complete": {
          const currentMetadata = tracker.getCurrentSectionMetadata();
          if (!currentMetadata) {
            return JSON.stringify({
              status: "error",
              message: "No section to complete - all sections already done",
            });
          }

          tracker.markSectionComplete(currentMetadata.sectionIndex);

          return JSON.stringify({
            status: "success",
            message: `Section ${currentMetadata.sectionIndex + 1} completed: "${currentMetadata.sectionTitle}"`,
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

        case "is_analysis_complete": {
          return JSON.stringify({
            status: "success",
            isComplete: tracker.isComplete(),
          });
        }

        case "start_qa_phase": {
          if (!tracker.isComplete()) {
            return JSON.stringify({
              status: "error",
              message:
                "Cannot start QA phase - not all sections have been analyzed yet",
            });
          }

          return JSON.stringify({
            status: "success",
            message: "QA phase can now begin - all sections analyzed",
            totalSections: tracker.getTotalSections(),
          });
        }

        case "get_revision_map": {
          const revisionMap = tracker.getRevisionMap();
          const hasRevisions = Object.keys(revisionMap).length > 0;

          return JSON.stringify({
            status: "success",
            hasRevisions,
            revisionMap,
            message: hasRevisions
              ? "Some sections need revision"
              : "No revisions needed - all analysis approved by QA",
          });
        }

        case "get_all_section_metadata": {
          const allMetadata = tracker.getAllSectionMetadata();
          return JSON.stringify({
            status: "success",
            sections: allMetadata,
            totalSections: tracker.getTotalSections(),
          });
        }

        default:
          throw new Error(
            `Unknown action: ${action}. Valid actions: get_next_section_metadata, mark_section_complete, get_progress, is_analysis_complete, start_qa_phase, get_revision_map, get_all_section_metadata`,
          );
      }
    },
    {
      name: "coordinator_tracker",
      description: `Manages bias detection workflow at the coordinator level (metadata-only access).
Use this tool to:
- get_next_section_metadata: Get next section number and title (NO content)
- mark_section_complete: Mark current section as complete after all agents finish
- get_progress: Check how many sections are done and how many remain
- is_analysis_complete: Check if all sections have been analyzed
- start_qa_phase: Trigger QA review phase (only works when all sections done)
- get_revision_map: Get which sections each agent should revisit (after QA)
- get_all_section_metadata: Get list of all section numbers and titles

IMPORTANT: This tool NEVER returns section content or analyses to save tokens.`,
      schema: z.object({
        action: z
          .enum([
            "get_next_section_metadata",
            "mark_section_complete",
            "get_progress",
            "is_analysis_complete",
            "start_qa_phase",
            "get_revision_map",
            "get_all_section_metadata",
          ])
          .describe(
            "The action to perform: get_next_section_metadata | mark_section_complete | get_progress | is_analysis_complete | start_qa_phase | get_revision_map | get_all_section_metadata",
          ),
      }),
    },
  );
}
