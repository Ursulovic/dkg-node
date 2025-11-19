import { tool } from "@langchain/core/tools";
import * as z from "zod";
import type { SectionTracker } from "../section-tracker";
import type { AgentName } from "../types";

/**
 * Creates a section reader tool for analysis subagents.
 * Allows subagents to fetch section content, save analyses, and access revision feedback.
 *
 * @param tracker - The section tracker instance
 * @param agentName - The name of the agent using this tool
 * @returns LangChain tool for section content and analysis access
 */
export function createSectionReaderTool(
  tracker: SectionTracker,
  agentName: AgentName,
) {
  return tool(
    async (input: {
      action: string;
      sectionIndex?: number;
      analysis?: string;
    }) => {
      const { action, sectionIndex, analysis } = input;

      switch (action) {
        case "get_section_content": {
          if (sectionIndex === undefined) {
            throw new Error(
              "sectionIndex is required for get_section_content action",
            );
          }

          const content = tracker.getSectionContent(sectionIndex);
          return JSON.stringify({
            status: "success",
            sectionIndex: content.sectionIndex,
            sectionTitle: content.sectionTitle,
            grokipediaChunk: content.grokipediaChunk,
            wikipediaChunk: content.wikipediaChunk,
            grokipediaLinks: content.grokipediaLinks,
            wikipediaLinks: content.wikipediaLinks,
            tokenEstimate: content.tokenEstimate,
          });
        }

        case "save_analysis": {
          if (sectionIndex === undefined) {
            throw new Error(
              "sectionIndex is required for save_analysis action",
            );
          }
          if (!analysis) {
            throw new Error("analysis is required for save_analysis action");
          }

          tracker.saveAnalysis(sectionIndex, agentName, analysis);

          return JSON.stringify({
            status: "success",
            message: `Analysis saved for section ${sectionIndex}`,
          });
        }

        case "get_previous_analysis": {
          if (sectionIndex === undefined) {
            throw new Error(
              "sectionIndex is required for get_previous_analysis action",
            );
          }

          const previousAnalysis = tracker.getAnalysis(
            sectionIndex,
            agentName,
          );

          if (!previousAnalysis) {
            return JSON.stringify({
              status: "no_analysis",
              message: `No previous analysis found for section ${sectionIndex}`,
            });
          }

          return JSON.stringify({
            status: "success",
            sectionIndex,
            previousAnalysis,
          });
        }

        case "get_qa_feedback": {
          if (sectionIndex === undefined) {
            throw new Error(
              "sectionIndex is required for get_qa_feedback action",
            );
          }

          const feedback = tracker.getQAFeedback(sectionIndex, agentName);

          if (!feedback) {
            return JSON.stringify({
              status: "no_feedback",
              message: `No QA feedback found for section ${sectionIndex}`,
            });
          }

          return JSON.stringify({
            status: "success",
            sectionIndex,
            feedback: {
              whatWasGood: feedback.whatWasGood,
              whatNeedsImprovement: feedback.whatNeedsImprovement,
              specificTasks: feedback.specificTasks,
            },
          });
        }

        default:
          throw new Error(
            `Unknown action: ${action}. Valid actions: get_section_content, save_analysis, get_previous_analysis, get_qa_feedback`,
          );
      }
    },
    {
      name: "section_reader",
      description: `Access section content and manage analyses for ${agentName}.
Use this tool to:
- get_section_content: Fetch Grokipedia and Wikipedia content for a section
- save_analysis: Save your completed analysis for a section
- get_previous_analysis: Retrieve your previous analysis (for revisions)
- get_qa_feedback: Get QA feedback on what to improve (for revisions)

Typical workflow:
1. get_section_content(sectionIndex) - fetch content
2. Analyze the content
3. save_analysis(sectionIndex, analysis) - save your work

Revision workflow:
1. get_section_content(sectionIndex) - fetch content
2. get_previous_analysis(sectionIndex) - see what you wrote before
3. get_qa_feedback(sectionIndex) - see what QA wants you to improve
4. Refine your analysis
5. save_analysis(sectionIndex, refinedAnalysis) - save improved work`,
      schema: z.object({
        action: z
          .enum([
            "get_section_content",
            "save_analysis",
            "get_previous_analysis",
            "get_qa_feedback",
          ])
          .describe(
            "The action to perform: get_section_content | save_analysis | get_previous_analysis | get_qa_feedback",
          ),
        sectionIndex: z
          .number()
          .optional()
          .describe(
            "Index of the section (required for all actions except initial queries)",
          ),
        analysis: z
          .string()
          .optional()
          .describe(
            "Your completed analysis text (required only for save_analysis action)",
          ),
      }),
    },
  );
}
