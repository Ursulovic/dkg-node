import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import * as z from "zod";
import type { SimilarityReport } from "../similarity/types";

/**
 * Zod schema for a single cross-referenced section
 */
const CrossReferencedSectionSchema = z.object({
  sectionIndex: z.number().describe("Zero-based index of this section"),
  sectionTitle: z.string().describe("Descriptive title for this section"),
  grokipediaChunk: z
    .string()
    .describe(
      "Verbatim content from Grokipedia (1-3 paragraphs with all citations and links)",
    ),
  wikipediaChunk: z
    .string()
    .describe(
      "Verbatim content from Wikipedia (corresponding section with all citations and links)",
    ),
  grokipediaLinks: z
    .array(z.string())
    .describe(
      "Extracted and de-referenced citations/links from Grokipedia chunk",
    ),
  wikipediaLinks: z
    .array(z.string())
    .describe(
      "Extracted and de-referenced citations/links from Wikipedia chunk",
    ),
  tokenEstimate: z.number().describe("Estimated token count for this section"),
});

/**
 * Zod schema for the array of cross-referenced sections
 */
const CrossReferencedSectionsSchema = z.array(CrossReferencedSectionSchema);

/**
 * TypeScript type inferred from Zod schema
 */
export type CrossReferencedSection = z.infer<
  typeof CrossReferencedSectionSchema
>;

const CROSS_REFERENCE_PROMPT = `You are an expert article analyzer creating cross-referenced sections for bias detection analysis.

## Your Mission

Create an array of cross-referenced sections that pair corresponding content from Grokipedia and Wikipedia articles. Each section should contain 1-3 paragraphs of verbatim content from each source.

## Input Context

You will receive:
1. Full Grokipedia article (markdown with citations and links)
2. Full Wikipedia article (markdown with citations and links)
3. Similarity analysis showing overall alignment and divergence areas

## CRITICAL RULES

**SECTION MATCHING**:
- Identify corresponding sections between Grokipedia and Wikipedia
- Match sections by topic/theme (titles don't need to be identical)
- Prioritize high-divergence areas flagged in similarity analysis
- Ensure all major topics from both sources are covered

**CONTENT EXTRACTION**:
- Extract 1-3 paragraphs verbatim from each source (NO paraphrasing)
- Include ALL citations, links, and references exactly as they appear
- Preserve markdown formatting (links, bold, italics, etc.)
- Target 500-1000 tokens per chunk (approximately 2-4 paragraphs)

**TABLE HANDLING**:
- If a section contains large tables, summarize key data points
- Or split tables into logical chunks if they're critical
- Preserve the most important data while keeping token count reasonable

**LINK EXTRACTION**:
- Extract all URLs, citations, and references from each chunk
- De-reference them into clean lists for easy agent access
- Include both inline links and citation references

## Output Format

Return an array of section objects with the following structure:
- sectionIndex: number (zero-based)
- sectionTitle: string (descriptive title)
- grokipediaChunk: string (verbatim paragraphs with links and citations)
- wikipediaChunk: string (verbatim paragraphs with links and citations)
- grokipediaLinks: string[] (extracted URLs and citations)
- wikipediaLinks: string[] (extracted URLs and citations)
- tokenEstimate: number (estimated tokens for this section)

## Important Notes

- Extract content VERBATIM - do not paraphrase or summarize (except tables)
- Ensure 1-to-1 matching: each Grokipedia section paired with corresponding Wikipedia section
- Use similarity analysis to prioritize divergent areas
- Keep sections focused and manageable (500-1000 tokens ideal)
- Preserve all attribution and source information

Now create cross-referenced sections from the following articles and similarity analysis:`;

/**
 * Creates cross-referenced sections between Grokipedia and Wikipedia articles.
 * Uses Gemini to intelligently match corresponding sections and extract verbatim content.
 *
 * @param grokipediaContent - Full markdown content from Grokipedia article
 * @param wikipediaContent - Full markdown content from Wikipedia article
 * @param similarityReport - Overall similarity analysis to guide section matching
 * @returns Array of cross-referenced sections ready for bias analysis
 */
export async function createCrossReferencedSections(
  grokipediaContent: string,
  wikipediaContent: string,
  similarityReport: SimilarityReport,
): Promise<CrossReferencedSection[]> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0,
  });

  // Format similarity context for the model
  const similarityContext = `
SIMILARITY ANALYSIS:
- Overall alignment: ${(similarityReport.overallAlignment * 100).toFixed(1)}%
- Text similarity: ${(similarityReport.text.overallSimilarity * 100).toFixed(1)}%
- Semantic similarity: ${(similarityReport.text.semanticSimilarity * 100).toFixed(1)}%
- Structural similarity: ${(similarityReport.text.structuralSimilarity * 100).toFixed(1)}%
- Media similarity: ${(similarityReport.media.imageSimilarityScore * 100).toFixed(1)}%

${
  similarityReport.divergenceAreas.length > 0
    ? `HIGH-DIVERGENCE AREAS (prioritize these):
${similarityReport.divergenceAreas.map((area) => `- ${area}`).join("\n")}`
    : ""
}

Use this analysis to prioritize section creation around divergent areas.
`;

  const userPrompt = `${similarityContext}

GROKIPEDIA ARTICLE:
---
${grokipediaContent}
---

WIKIPEDIA ARTICLE:
---
${wikipediaContent}
---

Create cross-referenced sections following the structure specified above.`;

  // Use structured output with Zod schema for automatic validation
  const modelWithStructuredOutput = model.withStructuredOutput(
    CrossReferencedSectionsSchema,
    {
      name: "cross_referenced_sections",
    },
  );

  // Retry logic with exponential backoff for robust structured output
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const sections = await modelWithStructuredOutput.invoke([
        { role: "system", content: CROSS_REFERENCE_PROMPT },
        { role: "user", content: userPrompt },
      ]);

      // Zod automatically validates and parses the response

      if (!Array.isArray(sections) || sections.length === 0) {
        throw new Error(
          "No sections returned from Gemini. The model may not have found matching content between the articles.",
        );
      }

      // Success - return sections
      return sections;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Log the attempt
      console.warn(
        `Cross-reference generation attempt ${attempt + 1}/${maxRetries} failed: ${lastError.message}`,
      );

      // If this was the last attempt, throw the error
      if (attempt === maxRetries - 1) {
        break;
      }

      // Exponential backoff: wait before retrying
      const backoffMs = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  // All retries exhausted
  throw new Error(
    `Failed to generate cross-referenced sections after ${maxRetries} attempts. Last error: ${lastError?.message}`,
  );
}
