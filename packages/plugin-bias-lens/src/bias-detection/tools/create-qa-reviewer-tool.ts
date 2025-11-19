import { tool } from "@langchain/core/tools";
import * as z from "zod";
import type { SectionTracker } from "../section-tracker";
import type { AgentName, QAFeedback } from "../types";

/**
 * Creates a QA reviewer tool for the quality assurance agent.
 * Allows batch access to all sections and analyses, and saves feedback for revisions.
 *
 * @param tracker - The section tracker instance
 * @returns LangChain tool for QA batch review
 */
export function createQAReviewerTool(tracker: SectionTracker) {
  return tool(
    async (input: {
      action: string;
      sectionIndex?: number;
      agentName?: string;
      feedback?: QAFeedback;
    }) => {
      const { action, sectionIndex, agentName, feedback } = input;

      switch (action) {
        case "get_all_sections_with_analyses": {
          const sectionsWithAnalyses = tracker.getAllSectionsWithAnalyses();

          return JSON.stringify({
            status: "success",
            totalSections: sectionsWithAnalyses.length,
            sections: sectionsWithAnalyses.map((swa) => ({
              sectionIndex: swa.section.sectionIndex,
              sectionTitle: swa.section.sectionTitle,
              tokenEstimate: swa.section.tokenEstimate,
              grokipediaChunk: swa.section.grokipediaChunk,
              wikipediaChunk: swa.section.wikipediaChunk,
              grokipediaLinks: swa.section.grokipediaLinks,
              wikipediaLinks: swa.section.wikipediaLinks,
              analyses: {
                factChecker: swa.analyses["fact-checker"] || null,
                contextAnalyzer: swa.analyses["context-analyzer"] || null,
                sourceVerifier: swa.analyses["source-verifier"] || null,
              },
            })),
          });
        }

        case "save_feedback": {
          if (sectionIndex === undefined) {
            throw new Error(
              "sectionIndex is required for save_feedback action",
            );
          }
          if (!agentName) {
            throw new Error("agentName is required for save_feedback action");
          }
          if (!feedback) {
            throw new Error("feedback is required for save_feedback action");
          }

          // Validate agent name
          const validAgentNames: AgentName[] = [
            "fact-checker",
            "context-analyzer",
            "source-verifier",
          ];
          if (!validAgentNames.includes(agentName as AgentName)) {
            throw new Error(
              `Invalid agentName: ${agentName}. Must be one of: ${validAgentNames.join(", ")}`,
            );
          }

          tracker.saveQAFeedback(
            sectionIndex,
            agentName as AgentName,
            feedback,
          );

          return JSON.stringify({
            status: "success",
            message: `Feedback saved for ${agentName} on section ${sectionIndex}`,
          });
        }

        case "finalize_qa": {
          const revisionMap = tracker.getRevisionMap();
          const hasRevisions = Object.keys(revisionMap).length > 0;

          return JSON.stringify({
            status: "success",
            hasRevisions,
            revisionMap,
            message: hasRevisions
              ? "QA complete - some sections need revision"
              : "QA complete - all analyses approved",
            summary: {
              totalSections: tracker.getTotalSections(),
              sectionsNeedingRevision: Object.values(revisionMap).flat()
                .length,
              agentsWithRevisions: Object.keys(revisionMap),
            },
          });
        }

        default:
          throw new Error(
            `Unknown action: ${action}. Valid actions: get_all_sections_with_analyses, save_feedback, finalize_qa`,
          );
      }
    },
    {
      name: "qa_reviewer",
      description: `Batch review tool for quality assurance agent.
Use this tool to:
- get_all_sections_with_analyses: Fetch ALL sections with ALL analyses from all agents (for batch review)
- save_feedback: Save improvement feedback for a specific agent on a specific section
- finalize_qa: Complete QA phase and get revision map

Typical workflow:
1. get_all_sections_with_analyses() - fetch everything for review
2. Review all sections and analyses
3. For each section needing improvement:
   save_feedback(sectionIndex, agentName, feedback)
4. finalize_qa() - get revision map to return to coordinator

Feedback structure:
{
  whatWasGood: "What the agent did well (for reference)",
  whatNeedsImprovement: "What needs to be improved",
  specificTasks: ["Task 1", "Task 2", ...]
}`,
      schema: z.object({
        action: z
          .enum([
            "get_all_sections_with_analyses",
            "save_feedback",
            "finalize_qa",
          ])
          .describe(
            "The action to perform: get_all_sections_with_analyses | save_feedback | finalize_qa",
          ),
        sectionIndex: z
          .number()
          .optional()
          .describe("Index of the section (required for save_feedback)"),
        agentName: z
          .string()
          .optional()
          .describe(
            "Name of the agent: fact-checker | context-analyzer | source-verifier (required for save_feedback)",
          ),
        feedback: z
          .object({
            whatWasGood: z
              .string()
              .describe("What the agent did well (for reference)"),
            whatNeedsImprovement: z
              .string()
              .describe("What needs to be improved"),
            specificTasks: z
              .array(z.string())
              .describe("Specific tasks to address"),
          })
          .optional()
          .describe("QA feedback object (required for save_feedback)"),
      }),
    },
  );
}
