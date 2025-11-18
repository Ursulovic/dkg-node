import { z } from "zod";

export const FactualErrorSchema = z.object({
  type: z
    .enum(["HALLUCINATION", "FALSE_CLAIM", "MISREPRESENTATION"])
    .describe("Type of factual error detected"),
  claim: z.string().describe("The claim made in the Grokipedia article"),
  reality: z
    .string()
    .describe("What the actual facts are, based on verification"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score for this detection (0-1)"),
  evidence: z
    .string()
    .optional()
    .describe("Supporting evidence for the detection"),
});

export type FactualError = z.infer<typeof FactualErrorSchema>;

export const MissingContextSchema = z.object({
  type: z
    .enum(["OMISSION", "CHERRY_PICKING", "SELECTIVE_REPORTING"])
    .describe("Type of missing context detected"),
  missing: z
    .string()
    .describe("What information is missing or under-represented"),
  impact: z
    .string()
    .describe("How this omission affects the article's objectivity"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score for this detection (0-1)"),
  evidence: z
    .string()
    .optional()
    .describe("Supporting evidence for the detection"),
});

export type MissingContext = z.infer<typeof MissingContextSchema>;

export const SourceProblemSchema = z.object({
  type: z
    .enum(["FAKE_CITATION", "MISATTRIBUTED_QUOTE", "UNRELIABLE_SOURCE"])
    .describe("Type of source problem detected"),
  cited: z.string().describe("The citation or source as it appears in the article"),
  issue: z.string().describe("What the problem is with this source"),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Confidence score for this detection (0-1)"),
  evidence: z
    .string()
    .optional()
    .describe("Supporting evidence for the detection"),
});

export type SourceProblem = z.infer<typeof SourceProblemSchema>;

export const BiasReportSchema = z.object({
  biasesDetected: z.object({
    factualErrors: z
      .array(FactualErrorSchema)
      .describe("List of factual errors detected"),
    missingContext: z
      .array(MissingContextSchema)
      .describe("List of missing context issues detected"),
    sourceProblems: z
      .array(SourceProblemSchema)
      .describe("List of source problems detected"),
  }),
  summary: z
    .string()
    .describe(
      "Executive summary of the bias analysis and key findings",
    ),
  overallConfidence: z
    .number()
    .min(0)
    .max(1)
    .describe("Overall confidence in the bias detection analysis (0-1)"),
});

export type BiasReport = z.infer<typeof BiasReportSchema>;
