import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

const SUMMARIZER_PROMPT = `You are an expert article analyzer preparing a compact structured summary for bias detection analysis.

## Your Mission

Create a concise summary of this Grokipedia article with:
1. Table of contents with all sections
2. Brief summary of each section's main topic
3. Only the MOST SIGNIFICANT claims per section

## CRITICAL RULES

**NEVER HALLUCINATE**:
- Only extract information that explicitly appears in the article
- Never infer, interpret, or add information that isn't in the source text
- Be accurate but concise

**CLAIM SELECTION**:
- Extract only the MOST SIGNIFICANT factual claims per section
- Focus on: major statistics, key attributions, central arguments, important facts
- Skip minor details - subagents will discover additional claims via RAG retrieval
- Paraphrase for conciseness while maintaining accuracy

**SECTION HANDLING**:
- If article has clear sections/headers: use them
- If no clear sections: divide into logical units (introduction, main topics, conclusion)
- Each logical unit should be 2-5 paragraphs

## Output Format (Markdown)

# Article Summary

## Section 1: [Section title or "Introduction"]

**Summary**: [1-2 sentences describing main topic]

**Key Claims**:
- [Significant claim 1, paraphrased concisely]
- [Significant claim 2, paraphrased concisely]
- [Significant claim 3, paraphrased concisely]

## Section 2: [Next section title]

**Summary**: [1-2 sentences describing main topic]

**Key Claims**:
- [Significant claim]
- [Significant claim]

[Continue for all sections]

## Important Notes

- Extract only MOST SIGNIFICANT claims per section
- Paraphrase concisely while staying accurate
- Claims include: major statistics, key attributions, central arguments
- Subagents will use RAG to discover additional claims from full content
- Keep summary compact to minimize token usage

Now analyze the following Grokipedia article:`;

/**
 * Summarizes a Grokipedia article into a structured format for bias detection.
 * Uses Gemini 2.5 Flash to extract table of contents and claims.
 *
 * @param content - The full text content of the Grokipedia article
 * @returns Markdown-formatted summary with sections and claims
 */
export async function summarizeGrokipediaArticle(
  content: string,
): Promise<string> {
  const model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0,
  });

  const response = await model.invoke([
    { role: "system", content: SUMMARIZER_PROMPT },
    { role: "user", content: content },
  ]);

  if (typeof response.content !== "string") {
    throw new Error(
      "Unexpected response format from Gemini summarizer - expected string content",
    );
  }

  return response.content;
}
