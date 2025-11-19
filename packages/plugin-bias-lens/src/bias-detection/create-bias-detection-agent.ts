import { createAgent, ReactAgent } from "langchain";
import type { StructuredTool } from "@langchain/core/tools";
import { BIAS_DETECTION_AGENT_PROMPT } from "./prompts/bias-detection-agent";
import { LanguageModelLike } from "@langchain/core/language_models/base";
import type { SectionContent, QAFeedback } from "./types";

export interface BiasDetectionAgentConfig {
  tavilySearch: StructuredTool;
  googleScholar: StructuredTool;
  model?: string | LanguageModelLike;
}

/**
 * Bias detection agent API with analyze method for parallel section processing
 */
export interface BiasDetectionAgentAPI {
  agent: ReactAgent;
  analyze: (
    sectionIndex: number,
    section: SectionContent,
    feedback?: QAFeedback,
    previousAnalysis?: string,
  ) => Promise<string>;
}

/**
 * Create prompt for initial section analysis
 */
function createAnalysisPrompt(
  sectionIndex: number,
  section: SectionContent,
): string {
  const grokLinks = section.grokipediaLinks.length > 0
    ? section.grokipediaLinks.map(link => `- ${link}`).join("\n")
    : "- (none)";

  const wikiLinks = section.wikipediaLinks.length > 0
    ? section.wikipediaLinks.map(link => `- ${link}`).join("\n")
    : "- (none)";

  const tasks = section.tasks.length > 0
    ? section.tasks.map((task, i) => `${i + 1}. **Claim:** "${task.claim}"\n   **Relevant Links:** ${task.relevantLinks.join(", ")}`).join("\n\n")
    : "- (none)";

  return `Analyze section ${sectionIndex} for bias across all three dimensions.

**Section ${sectionIndex}: ${section.sectionTitle}**

**Grokipedia Content:**
${section.grokipediaChunk}

**Wikipedia Content:**
${section.wikipediaChunk}

**Grokipedia Links:**
${grokLinks}

**Wikipedia Links:**
${wikiLinks}

**Verification Tasks (Priority Claims to Check):**
${tasks}

Your task:
1. Review the verification tasks above - these are key claims that need checking
2. Analyze comprehensively for factual accuracy, contextual balance, and source reliability
3. Use web_search or search_google_scholar to verify suspicious claims/citations as needed
4. Use the provided links from both sources to cross-reference claims
5. Save your findings using: save_section_analysis(${sectionIndex}, analysis)

Remember: Every finding MUST include source URLs. Use the JSON format specified in your system prompt.`;
}

/**
 * Create prompt for section revision based on QA feedback
 */
function createRevisionPrompt(
  sectionIndex: number,
  section: SectionContent,
  previousAnalysis: string,
  feedback: QAFeedback,
): string {
  return `Revise your analysis for section ${sectionIndex} based on QA feedback.

**Section ${sectionIndex}: ${section.sectionTitle}**

**Grokipedia Content:**
${section.grokipediaChunk}

**Wikipedia Content:**
${section.wikipediaChunk}

**Your Previous Analysis:**
${previousAnalysis}

**QA Feedback:**
What was good: ${feedback.whatWasGood}

What needs improvement: ${feedback.whatNeedsImprovement}

Specific tasks to complete:
${feedback.specificTasks.map((task, i) => `${i + 1}. ${task}`).join("\n")}

Your task:
1. Address ALL specific tasks from QA
2. Build upon your previous work (don't start from scratch)
3. Use web_search or search_google_scholar as needed
4. Save your improved analysis using: save_section_analysis(${sectionIndex}, revisedAnalysis)

Remember: Every finding MUST include source URLs.`;
}

/**
 * Create the unified bias detection agent with analyze method for parallel processing
 *
 * This agent analyzes individual sections for:
 * - Factual accuracy (fact-checking)
 * - Contextual balance (context analysis)
 * - Source reliability (source verification)
 *
 * @param config - Configuration including section store and search tools
 * @returns API object with agent and analyze method
 */
export function createBiasDetectionAgent(
  config: BiasDetectionAgentConfig,
): BiasDetectionAgentAPI {
  const {
    tavilySearch,
    googleScholar,
    model = "claude-sonnet-4-5-20250929",
  } = config;

  // Create the agent
  const agent = createAgent({
    name: "bias-detection-agent",
    model,
    tools: [tavilySearch, googleScholar],
    systemPrompt: BIAS_DETECTION_AGENT_PROMPT,
  });

  // Return API with analyze method
  return {
    agent,
    analyze: async (
      sectionIndex: number,
      section: SectionContent,
      feedback?: QAFeedback,
      previousAnalysis?: string,
    ): Promise<string> => {
      const isRevision = !!feedback && !!previousAnalysis;

      const prompt = isRevision
        ? createRevisionPrompt(sectionIndex, section, previousAnalysis, feedback)
        : createAnalysisPrompt(sectionIndex, section);

      try {
        const response = await agent.invoke({
          messages: [{ role: "user", content: prompt }],
        });

        // Extract final response from agent
        const lastMessage = response.messages[response.messages.length - 1];
        if (!lastMessage) {
          throw new Error("No response from agent");
        }

        const analysisMarkdown =
          typeof lastMessage.content === "string"
            ? lastMessage.content
            : JSON.stringify(lastMessage.content);

        return analysisMarkdown;
      } catch (error) {
        console.error(
          `❌ Bias detection agent failed for section ${sectionIndex}: "${section.sectionTitle}"`,
          error,
        );
        throw error;
      }
    },
  };
}
