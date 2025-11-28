import { z } from "zod";

const RatingSchema = z.object({
  "@type": z.literal("Rating"),
  ratingValue: z.number(),
  bestRating: z.number(),
  worstRating: z.number(),
  ratingExplanation: z.string(),
});

const ArticleRefSchema = z.object({
  "@type": z.literal("Article"),
  url: z.string(),
  name: z.string().optional(),
  identifier: z.string().optional(),
});

const ThingSchema = z.object({
  "@type": z.literal("Thing"),
  name: z.string(),
});

const ItemListSchema = z.object({
  "@type": z.literal("ItemList"),
  numberOfItems: z.number().int().nonnegative(),
  description: z.string(),
});

const OrganizationSchema = z.object({
  "@type": z.literal("Organization"),
  name: z.string(),
  url: z.string(),
});

const SoftwareApplicationSchema = z.object({
  "@type": z.literal("SoftwareApplication"),
  name: z.string(),
  softwareVersion: z.string(),
});

const OfferSchema = z.object({
  "@type": z.literal("Offer"),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  priceCurrency: z.string(),
  url: z.string(),
  seller: z.object({
    "@type": z.literal("Organization"),
    identifier: z.string().describe("Wallet address for x402 payments"),
  }),
});

const PublicBiasReportSchema = z
  .object({
    "@context": z.literal("https://schema.org/"),
    "@type": z.literal("ClaimReview"),
    "@id": z.string(),
    name: z.string(),
    itemReviewed: ArticleRefSchema,
    isBasedOn: ArticleRefSchema,
    reviewBody: z.string(),
    reviewRating: RatingSchema,
    keywords: z.array(z.string()),
    about: ThingSchema,
    negativeNotes: ItemListSchema,
    publisher: OrganizationSchema,
    creator: SoftwareApplicationSchema,
    datePublished: z.string(),
    license: z.string(),
    offers: OfferSchema,
  })
  .describe("Public part of bias report - searchable summary (schema.org ClaimReview)");

const CitationSchema = z.object({
  "@type": z.enum(["ScholarlyArticle", "WebPage"]),
  name: z.string(),
  url: z.string(),
  author: z.string().optional(),
  abstract: z.string().optional(),
  citation: z.number().int().nonnegative().optional(),
});

const ClaimSchema = z.object({
  "@type": z.literal("Claim"),
  text: z.string(),
});

const ArticleSectionSchema = z.object({
  "@type": z.literal("Article"),
  articleSection: z.string(),
});

const PrivateClaimReviewSchema = z.object({
  "@type": z.literal("ClaimReview"),
  claimReviewed: z.string(),
  reviewBody: z.string(),
  reviewRating: RatingSchema,
  itemReviewed: ClaimSchema,
  isPartOf: ArticleSectionSchema,
  citation: z.array(CitationSchema),
  reviewAspect: z.enum(["factualError", "missingContext", "sourceProblem", "mediaIssue"]).optional(),
});

const ContentRatingSchema = z.object({
  "@type": z.literal("Rating"),
  ratingValue: z.number(),
  bestRating: z.number(),
  worstRating: z.number(),
  ratingExplanation: z.string(),
});

const SimilarityReviewSchema = z.object({
  "@type": z.literal("Review"),
  reviewAspect: z.literal("contentSimilarity"),
  reviewBody: z.string(),
  reviewRating: RatingSchema,
  contentRating: z.array(ContentRatingSchema),
});

const PrivateBiasReportSchema = z
  .object({
    "@context": z.literal("https://schema.org/"),
    "@id": z.string(),
    review: SimilarityReviewSchema,
    hasPart: z.array(PrivateClaimReviewSchema),
  })
  .describe("Private part of bias report - detailed findings (paid access)");

const BiasReportKnowledgeAssetSchema = z
  .object({
    public: PublicBiasReportSchema,
    private: PrivateBiasReportSchema,
  })
  .describe("Combined public/private bias report for DKG publishing");

const SourceVersionSchema = z
  .object({
    grokipedia: z.object({
      url: z.string(),
      accessedAt: z.string(),
      pageHash: z.string().optional(),
    }),
    wikipedia: z.object({
      url: z.string(),
      accessedAt: z.string(),
      revisionId: z.string().optional(),
      pageHash: z.string().optional(),
    }),
  })
  .describe("Source version metadata for provenance tracking");

export type PublicBiasReport = z.infer<typeof PublicBiasReportSchema>;
export type PrivateBiasReport = z.infer<typeof PrivateBiasReportSchema>;
export type BiasReportKnowledgeAsset = z.infer<typeof BiasReportKnowledgeAssetSchema>;
export type SourceVersions = z.infer<typeof SourceVersionSchema>;
export type Rating = z.infer<typeof RatingSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type PrivateClaimReview = z.infer<typeof PrivateClaimReviewSchema>;
export type SimilarityReview = z.infer<typeof SimilarityReviewSchema>;

export {
  PublicBiasReportSchema,
  PrivateBiasReportSchema,
  BiasReportKnowledgeAssetSchema,
  SourceVersionSchema,
  RatingSchema,
  CitationSchema,
  PrivateClaimReviewSchema,
  SimilarityReviewSchema,
};
