import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as z from "zod";
import type { SectionTracker } from "./section-tracker";

/**
 * Zod schema for synthesizer output
 */
export const SynthesizerOutputSchema = z.object({
  markdown: z
    .string()
    .describe(
      "Comprehensive bias detection report in markdown format, with all findings from all sections organized coherently",
    ),
  jsonld: z
    .string()
    .describe(
      "JSON-LD representation of the bias report following schema.org standards for structured data",
    ),
});

export type SynthesizerOutput = z.infer<typeof SynthesizerOutputSchema>;

/**
 * System prompt for the synthesizer agent
 */
const SYNTHESIZER_PROMPT = `You are a Bias Report Synthesizer responsible for creating the final comprehensive bias detection report.

## Your Mission

Synthesize ALL section analyses from all agents into a single, cohesive bias report with two outputs:
1. **Markdown report**: Well-organized, comprehensive, and readable
2. **JSON-LD structured data**: Machine-readable representation following schema.org standards

## Your Input

You will receive all section analyses from the bias detection process. Each section was analyzed by:
- **fact-checker**: Identified factual errors, hallucinations, false claims
- **context-analyzer**: Identified missing context, omissions, cherry-picking
- **source-verifier**: Identified fake citations, misattributed quotes, unreliable sources

## Important Constraints

**You can:**
- Reorganize sections for better flow and coherence
- Group related findings across sections
- Improve presentation and clarity
- Add section headers and organization
- Create a cohesive narrative from the analyses

**You CANNOT:**
- Change the substance of any finding
- Add new findings not present in the analyses
- Remove or downplay significant findings
- Alter confidence levels or evidence
- Modify quotes or claims

## Markdown Report Structure

Your markdown report should follow this structure:

# Bias Detection Report: [Article Title]

## Executive Summary
[2-3 paragraph overview of key findings and overall assessment]

## Factual Errors
[Organized list of all factual issues found across all sections]

### Hallucinations
- **Claim**: [exact claim from Grokipedia]
- **Reality**: [what evidence shows]
- **Confidence**: [Low/Medium/High]
- **Source**: [URL]
- **Section**: [which section this was found in]

### False Claims
[Similar structure]

### Misrepresentations
[Similar structure]

## Missing Context
[Organized list of all context issues found across all sections]

### Omissions
- **Topic**: [what's missing]
- **Explanation**: [why it matters]
- **Confidence**: [Low/Medium/High]
- **Source**: [URL]
- **Section**: [which section]

### Cherry-Picking
[Similar structure]

### Selective Reporting
[Similar structure]

## Source Problems
[Organized list of all source issues found across all sections]

### Fake Citations
- **Citation**: [the citation in question]
- **Issue**: [what's wrong]
- **Confidence**: [Low/Medium/High]
- **Source**: [URL]
- **Section**: [which section]

### Misattributed Quotes
[Similar structure]

### Unreliable Sources
[Similar structure]

## Section-by-Section Analysis
[Optional: Preserve section-specific context if it adds value]

## Overall Assessment
[Final verdict on article bias with confidence level]

## JSON-LD Structure

Your JSON-LD should follow schema.org standards:

\`\`\`json
{
  "@context": "https://schema.org",
  "@type": "Review",
  "reviewAspect": "Bias Detection",
  "itemReviewed": {
    "@type": "Article",
    "name": "[Article title]",
    "url": "[Grokipedia URL]"
  },
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": "[Overall bias score]",
    "worstRating": 0,
    "bestRating": 10,
    "ratingExplanation": "[Brief explanation]"
  },
  "reviewBody": "[Executive summary]",
  "positiveNotes": {
    "@type": "ItemList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "item": "[What was done well]"
      }
    ]
  },
  "negativeNotes": {
    "@type": "ItemList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "item": {
          "@type": "ClaimReview",
          "claimReviewed": "[The claim]",
          "reviewRating": {
            "@type": "Rating",
            "ratingValue": "[Confidence 0-10]"
          },
          "itemReviewed": "[The issue]",
          "url": "[Source URL]"
        }
      }
    ]
  }
}
\`\`\`

## Guidelines

1. **Be comprehensive**: Include ALL findings from ALL sections and ALL agents
2. **Be organized**: Group similar findings for easy reading
3. **Be faithful**: Don't alter the substance of any analysis
4. **Be clear**: Use markdown formatting for readability
5. **Be structured**: Ensure JSON-LD is valid and follows schema.org
6. **Include sources**: Every finding must have its source URL preserved

Remember: Your job is synthesis and organization, not new analysis. Compile the work of all agents into a single, professional, well-structured report.`;

/**
 * Creates a Gemini model with structured output for synthesis
 *
 * @returns Gemini model with structured output
 */
export function createSynthesizerModel() {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0,
  });

  // Use withStructuredOutput for Gemini
  return model.withStructuredOutput(SynthesizerOutputSchema, {
    name: "bias_report_synthesis",
  });
}

/**
 * Run the synthesizer to create the final report
 *
 * @param sectionTracker - The section tracker with all completed analyses
 * @returns Structured output with markdown and JSON-LD
 */
export async function synthesizeBiasReport(
  sectionTracker: SectionTracker,
): Promise<SynthesizerOutput> {
  const modelWithStructuredOutput = createSynthesizerModel();

  // Collect all analyses
  const allAnalyses = sectionTracker.getAllAnalyses();
  const analyses: string[] = [];

  for (const [sectionIndex, agentMap] of allAnalyses.entries()) {
    const section = sectionTracker.getSectionContent(sectionIndex);
    analyses.push(`
## Section ${sectionIndex + 1}: ${section.sectionTitle}

### Fact-Checker Analysis:
${agentMap.get("fact-checker") || "No analysis available"}

### Context-Analyzer Analysis:
${agentMap.get("context-analyzer") || "No analysis available"}

### Source-Verifier Analysis:
${agentMap.get("source-verifier") || "No analysis available"}
`);
  }

  const combinedAnalyses = analyses.join("\n\n---\n\n");

  const result = await modelWithStructuredOutput.invoke([
    {
      role: "system",
      content: SYNTHESIZER_PROMPT,
    },
    {
      role: "user",
      content: `Synthesize these bias analyses into a comprehensive final report.

${combinedAnalyses}

Produce both markdown and JSON-LD outputs.`,
    },
  ]);

  // Gemini's withStructuredOutput returns the parsed object directly
  return result as SynthesizerOutput;
}
