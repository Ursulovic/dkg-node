# Bias Detection Schema Architecture

## Overview

The bias detection system produces JSON-LD compliant Knowledge Assets that compare Grokipedia articles against Wikipedia baselines. Reports are split into public (free) and private (paid) parts, enabling monetization through the OriginTrail DKG.

## Design Principles

### Why JSON-LD?

- **Interoperability**: Standard format for linked data on the semantic web
- **DKG Compatibility**: Native format for OriginTrail Knowledge Assets
- **Self-describing**: Context defines vocabulary, enabling machine interpretation
- **Extensibility**: Multiple namespaces can coexist cleanly

### Why schema.org?

- **Industry standard**: Used by Google, Bing, and major search engines
- **Fact-checking vocabulary**: `ClaimReview` is the standard for fact-checkers (Google Fact Check Tools, ClaimReview markup)
- **Rich type system**: `Review`, `Rating`, `Article`, `Claim` map naturally to bias analysis concepts
- **SEO benefits**: Reports can be indexed and surfaced in search results

## Schema Architecture

### Public/Private Split

Reports are split at publish time to enable monetization:

```
┌─────────────────────────────────────────────────────────────┐
│                    BiasReportKnowledgeAsset                 │
├─────────────────────────────┬───────────────────────────────┤
│         PUBLIC              │           PRIVATE             │
│        (Free)               │         (Paid)                │
├─────────────────────────────┼───────────────────────────────┤
│ • Bias rating (1-5)         │ • Detailed ClaimReviews       │
│ • Executive summary         │ • Full source citations       │
│ • Issue counts              │ • Per-claim confidence        │
│ • Similarity metrics        │ • Section-level attribution   │
│ • Provenance metadata       │ • Tool usage per claim        │
│ • Payment info (publisher)  │                               │
└─────────────────────────────┴───────────────────────────────┘
```

**Rationale**: Users can assess report value from the free public part before paying for detailed findings.

## Namespace Strategy

```json
{
  "@context": {
    "@vocab": "https://schema.org/",
    "prov": "http://www.w3.org/ns/prov#"
  }
}
```

| Namespace | Purpose | Examples |
|-----------|---------|----------|
| `schema.org` (default) | Core vocabulary | `Review`, `ClaimReview`, `Rating`, `Article` |
| `prov:` | W3C Provenance Ontology | `prov:wasGeneratedBy`, `prov:used`, `prov:Entity` |

**Why no custom namespace?** We use `schema.org` + `additionalProperty` pattern for all custom fields including payment information. This ensures:
- Maximum interoperability with existing tools
- No namespace registration required
- Validators understand the structure
- Valid JSON-LD that passes standard validators

## Key Type Mappings

### Article-Level Review → `schema:Review`

The top-level report uses `Review` (not `ClaimReview`) because we're reviewing an entire article, not a single claim.

```json
{
  "@type": "Review",
  "itemReviewed": { "@type": "Article", "url": "https://grokipedia.com/..." },
  "isBasedOn": { "@type": "Article", "url": "https://en.wikipedia.org/..." },
  "reviewRating": { "@type": "Rating", "ratingValue": 2, "bestRating": 5 }
}
```

### Bias Level → `schema:Rating`

| biasLevel | ratingValue | Meaning |
|-----------|-------------|---------|
| `none` | 5 | No bias detected |
| `low` | 4 | Minor issues |
| `moderate` | 3 | Notable problems |
| `high` | 2 | Serious bias |
| `severe` | 1 | Extensive misinformation |

### Individual Findings → `schema:ClaimReview`

Each factual error, missing context, or source problem becomes a `ClaimReview` in the private part:

```json
{
  "@type": "ClaimReview",
  "claimReviewed": "Global temperatures have only risen 0.5°C",
  "reviewBody": "Understates warming by 50%. IPCC AR6 confirms 1.1°C.",
  "reviewAspect": "factualError",
  "citation": [{ "@type": "ScholarlyArticle", "name": "IPCC AR6..." }]
}
```

### Provenance → W3C PROV-O

Agent attribution and source tracking use standard PROV-O:

```json
{
  "prov:wasGeneratedBy": {
    "@type": "prov:Activity",
    "prov:wasAssociatedWith": {
      "@type": "SoftwareApplication",
      "name": "ConsensusLens Bias Detection Agent",
      "softwareVersion": "2.0"
    },
    "prov:used": ["google_scholar_search", "web_search"]
  },
  "prov:used": [
    {
      "@type": "prov:Entity",
      "@id": "https://en.wikipedia.org/wiki/Climate_change",
      "prov:generatedAtTime": "2024-01-15T10:00:00Z",
      "identifier": "1234567890"
    }
  ]
}
```

### Custom Metrics → `schema:PropertyValue`

Metrics without direct schema.org mappings use the `additionalProperty` pattern:

```json
{
  "additionalProperty": [
    { "@type": "PropertyValue", "propertyID": "semanticSimilarity", "value": 0.72 },
    { "@type": "PropertyValue", "propertyID": "totalFactualErrors", "value": 5 },
    { "@type": "PropertyValue", "propertyID": "privateContentAvailable", "value": true },
    { "@type": "PropertyValue", "propertyID": "privateAccessFee", "value": "1.0 TRAC" }
  ]
}
```

## Payment Integration

Payment fields use the `additionalProperty` pattern on the publisher for clean schema.org compliance:

```json
{
  "publisher": {
    "@type": "Organization",
    "name": "ConsensusLens",
    "additionalProperty": [
      { "@type": "PropertyValue", "propertyID": "walletAddress", "value": "0x1234...5678" },
      { "@type": "PropertyValue", "propertyID": "paymentNetwork", "value": "otp:20430" },
      { "@type": "PropertyValue", "propertyID": "paymentToken", "value": "TRAC" }
    ]
  },
  "additionalProperty": [
    { "@type": "PropertyValue", "propertyID": "tokenUsage", "value": 45000 },
    { "@type": "PropertyValue", "propertyID": "costUSD", "value": 0.065 },
    { "@type": "PropertyValue", "propertyID": "costTRAC", "value": 0.13 },
    { "@type": "PropertyValue", "propertyID": "readCostMultiplier", "value": 10 },
    { "@type": "PropertyValue", "propertyID": "calculatedReadCost", "value": 1.3 },
    { "@type": "PropertyValue", "propertyID": "privateContentAvailable", "value": true },
    { "@type": "PropertyValue", "propertyID": "privateAccessFee", "value": "1.0 TRAC" }
  ]
}
```

## Sample Output

### Public Part (Abbreviated)

```json
{
  "@context": {
    "@vocab": "https://schema.org/",
    "prov": "http://www.w3.org/ns/prov#"
  },
  "@type": "Review",
  "@id": "did:dkg:otp:20430/consensus-lens/asset-123",
  "itemReviewed": {
    "@type": "Article",
    "url": "https://grokipedia.com/wiki/Climate_Change",
    "name": "Climate Change"
  },
  "reviewRating": {
    "@type": "Rating",
    "ratingValue": 2,
    "bestRating": 5,
    "worstRating": 1,
    "ratingExplanation": "Significant bias detected"
  },
  "reviewBody": "Analysis reveals significant divergence from Wikipedia...",
  "keywords": ["Cherry-picking statistics", "Omission of scientific consensus"],
  "negativeNotes": {
    "@type": "ItemList",
    "numberOfItems": 8,
    "description": "5 factual errors, 3 missing context issues"
  },
  "publisher": {
    "@type": "Organization",
    "name": "ConsensusLens",
    "additionalProperty": [
      { "@type": "PropertyValue", "propertyID": "walletAddress", "value": "0x1234...5678" },
      { "@type": "PropertyValue", "propertyID": "paymentNetwork", "value": "otp:20430" },
      { "@type": "PropertyValue", "propertyID": "paymentToken", "value": "TRAC" }
    ]
  },
  "additionalProperty": [
    { "@type": "PropertyValue", "propertyID": "privateContentAvailable", "value": true },
    { "@type": "PropertyValue", "propertyID": "privateAccessFee", "value": "1.0 TRAC" }
  ]
}
```

### Private Part (Abbreviated)

```json
{
  "@context": {
    "@vocab": "https://schema.org/",
    "prov": "http://www.w3.org/ns/prov#"
  },
  "@id": "did:dkg:otp:20430/consensus-lens/asset-123",
  "hasPart": [
    {
      "@type": "ClaimReview",
      "claimReviewed": "Global temperatures have only risen 0.5°C",
      "reviewBody": "Understates warming. IPCC AR6 confirms 1.1°C since pre-industrial.",
      "reviewRating": { "@type": "Rating", "ratingValue": 1 },
      "citation": [
        {
          "@type": "ScholarlyArticle",
          "name": "IPCC AR6 Synthesis Report",
          "url": "https://www.ipcc.ch/report/ar6/syr/",
          "citation": 15000
        }
      ],
      "reviewAspect": "factualError",
      "prov:wasGeneratedBy": {
        "@type": "prov:Activity",
        "prov:used": ["google_scholar_search"]
      }
    }
  ]
}
```

## Schema Files

| File | Purpose |
|------|---------|
| `src/agents/bias-detector/schema.ts` | Zod schemas for validation |
| `src/utils/ratingMapper.ts` | biasLevel → Rating conversion |
| `src/utils/jsonldFormatter.ts` | Public/private split and JSON-LD formatting |
| `src/utils/jsonldValidator.ts` | JSON-LD validation using jsonld.js |
| `src/agents/bias-detector/enrichResponse.ts` | Transform LLM response to full report |
