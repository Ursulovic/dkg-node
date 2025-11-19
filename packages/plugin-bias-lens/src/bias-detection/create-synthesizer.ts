import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as z from "zod";
import type { SectionAnalysis } from "./types";

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
const SYNTHESIZER_PROMPT = `You are a Bias Report Aggregator responsible for creating the final comprehensive bias detection report.

## Your Mission

**AGGREGATE** ALL section analyses into a single, organized bias report with two outputs:
1. **Markdown report**: All findings from all sections, organized by category
2. **JSON-LD structured data**: Machine-readable representation following schema.org standards

## CRITICAL REQUIREMENT: DO NOT SUMMARIZE

**Your output should be approximately as long as all input analyses combined.**

Your job is to **COLLECT and ORGANIZE**, NOT to condense or summarize:
- Take EVERY finding from EVERY section
- Organize them by category (Factual Errors, Missing Context, Source Problems)
- Preserve ALL detail from each section analysis
- DO NOT deduplicate unless findings are truly identical (same claim, same source)
- DO NOT remove any findings because they seem minor
- DO NOT shorten descriptions or evidence

## Your Input

You will receive all section analyses from the bias detection process. Each section was comprehensively analyzed across three dimensions:
- **Factual Accuracy**: Identified factual errors, hallucinations, false claims
- **Contextual Balance**: Identified missing context, omissions, cherry-picking
- **Source Reliability**: Identified fake citations, misattributed quotes, unreliable sources

## Important Constraints

**You MUST:**
- Include EVERY finding from EVERY section (no exceptions)
- Preserve all detail, evidence, and confidence levels exactly as provided
- Organize findings by type (categorize, don't condense)
- Maintain the full length of all analyses combined

**You CANNOT:**
- Summarize or condense any findings
- Remove findings because sections seem similar
- Change the substance of any finding
- Add new findings not present in the analyses
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

1. **Be comprehensive**: Include EVERY SINGLE finding from EVERY section - no exceptions
2. **Preserve detail**: Maintain all evidence, explanations, and confidence levels exactly as provided
3. **Organize, don't condense**: Group findings by category but preserve all detail
4. **Be faithful**: Don't alter the substance of any analysis
5. **Be clear**: Use markdown formatting for readability
6. **Be structured**: Ensure JSON-LD is valid and follows schema.org
7. **Include sources**: Every finding must have its source URL preserved
8. **Maintain length**: Your output should be approximately as long as all input analyses combined

Remember: Your job is AGGREGATION and ORGANIZATION, not summarization. Collect ALL findings from ALL sections and organize them by category while preserving complete detail.`;

/**
 * Creates a Gemini model with structured output for synthesis
 *
 * @returns Gemini model with structured output
 */
export function createSynthesizerModel() {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-3-pro-preview",
  });

  // Use withStructuredOutput for Gemini
  return model.withStructuredOutput(SynthesizerOutputSchema, {
    name: "bias_report_synthesis",
  });
}

/**
 * Run the synthesizer to create the final report
 *
 * @param sectionAnalyses - Array of section analyses with their metadata
 * @returns Structured output with markdown and JSON-LD
 */
export async function synthesizeBiasReport(
  sectionAnalyses: SectionAnalysis[],
): Promise<SynthesizerOutput> {
  const modelWithStructuredOutput = createSynthesizerModel();

  // Build analyses from direct input
  const analyses = sectionAnalyses.map(
    (section) => `
## Section ${section.sectionIndex + 1}: ${section.sectionTitle}

### Comprehensive Bias Analysis:
${section.analysis}
`,
  );

  const combinedAnalyses = analyses.join("\n\n---\n\n");

  const result = await modelWithStructuredOutput.invoke([
    {
      role: "system",
      content: SYNTHESIZER_PROMPT,
    },
    {
      role: "user",
      content: `Aggregate ALL bias analyses into a comprehensive final report.

CRITICAL: Include EVERY finding from EVERY section below. DO NOT summarize or condense - organize by category while preserving all detail.

${combinedAnalyses}

Produce both markdown and JSON-LD outputs. Your markdown output should be approximately as long as all the section analyses above combined.`,
    },
  ]);

  // Gemini's withStructuredOutput returns the parsed object directly
  return result as SynthesizerOutput;
}
