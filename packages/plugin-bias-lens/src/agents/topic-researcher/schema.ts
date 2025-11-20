import { z } from "zod";

const TopicUrlPairSchema = z
  .object({
    wikipediaUrl: z.string(),
    wikipediaPageSummary: z.string().max(500),
    grokipediaUrl: z.string(),
    grokipediaPageSummary: z.string().max(500),
  })
  .required()
  .describe(
    "Contains a validated pair of encyclopedia article URLs with brief summaries from both Grokipedia and Wikipedia for the same topic. Includes wikipediaUrl (the Wikipedia article URL), wikipediaPageSummary (a concise 500-character summary of the Wikipedia article content), grokipediaUrl (the Grokipedia article URL), and grokipediaPageSummary (a concise 500-character summary of the Grokipedia article content). This structured output enables comparison between how the same topic is covered on both platforms and provides quick context about each article's content without requiring the user to visit the pages.Retry",
  );

export type TopicUrlPair = z.infer<typeof TopicUrlPairSchema>;

export { TopicUrlPairSchema };
export default TopicUrlPairSchema;
