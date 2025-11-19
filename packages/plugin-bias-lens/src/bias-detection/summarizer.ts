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
      "Verbatim paragraph content from Grokipedia (inline links removed and extracted to grokipediaLinks array)",
    ),
  wikipediaChunk: z
    .string()
    .describe(
      "Verbatim paragraph content from Wikipedia (inline links removed and extracted to wikipediaLinks array)",
    ),
  grokipediaLinks: z
    .array(z.string())
    .describe("All citations and URLs extracted from Grokipedia chunk"),
  wikipediaLinks: z
    .array(z.string())
    .describe("All citations and URLs extracted from Wikipedia chunk"),
  tasks: z
    .array(
      z.object({
        claim: z
          .string()
          .describe(
            "Summarized claim from Grokipedia content that needs bias verification",
          ),
        relevantLinks: z
          .array(z.string())
          .describe(
            "URLs from BOTH Grokipedia and Wikipedia relevant to verifying this specific claim",
          ),
      }),
    )
    .describe(
      "List of verification tasks - key claims from Grokipedia with relevant source links",
    ),
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

Create an array of cross-referenced sections that pair corresponding content from Grokipedia and Wikipedia articles. Each section should contain verbatim paragraph content from each source.

## Input Context

You will receive:
1. Full Grokipedia article (markdown with citations and links)
2. Full Wikipedia article (markdown with citations and links)

## CRITICAL RULES

**SECTION STRUCTURE**:
Each section MUST contain:
- sectionIndex: Sequential number starting from 0
- sectionTitle: Clear, descriptive title
- grokipediaChunk: VERBATIM paragraph text (inline links removed)
- wikipediaChunk: VERBATIM paragraph text (inline links removed)
- grokipediaLinks: All URLs/citations extracted from grokipediaChunk
- wikipediaLinks: All URLs/citations extracted from wikipediaChunk
- tasks: Array of verification tasks with {claim, relevantLinks} structure

**CONTENT EXTRACTION RULES**:

1. **Paragraph Content**: Extract VERBATIM - exact quotes, no paraphrasing
2. **Links**: Remove inline citations/links from paragraph text, extract to links arrays
3. **Tables**: Can be summarized to key data points (not required verbatim)
4. **Tasks**: For each section, identify 3-7 key verifiable claims from Grokipedia content
   - Summarize each claim clearly
   - Include relevant URLs from BOTH Grokipedia AND Wikipedia for cross-verification
   - Focus on factual statements, statistics, attributions, and specific assertions
5. **Coverage**: Include ALL major topics from BOTH articles - do not skip sections
6. **Matching**: Ensure 1-to-1 pairing between Grokipedia and Wikipedia sections

## Important Notes

- Extract paragraph content VERBATIM - exact quotes, no paraphrasing
- Tables can be summarized to key data points
- Ensure comprehensive coverage - include ALL major topics from both articles
- Create verification tasks for key Grokipedia claims
- Preserve all attribution and source information

Now create cross-referenced sections from the following articles:`;

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
    model: "gemini-3-pro-preview",
    cache: true,
  });

  const userPrompt = `
GROKIPEDIA ARTICLE:
---
${grokipediaContent}
---

WIKIPEDIA ARTICLE:
---
${wikipediaContent}
---

Create cross-referenced sections following the structure above.

CRITICAL REQUIREMENTS:
1. Extract ALL paragraph content VERBATIM (exact quotes from original text)
2. Remove inline links/citations from paragraph text, extract to links arrays
3. Create verification tasks for key Grokipedia claims with relevant links from BOTH sources
4. Tables can be summarized (not required verbatim)
5. Ensure comprehensive coverage - include ALL major topics, do not skip sections
`;

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
