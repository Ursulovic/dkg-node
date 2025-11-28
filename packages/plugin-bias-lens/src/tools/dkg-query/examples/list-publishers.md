# List Available Publishers

**ID**: list-publishers
**Category**: publisher-discovery
**Priority**: 7
**Keywords**: publishers, list, available, sources, discover, who, civiclens, biaslens

## Description

Discover which publishers have contributed reports to the DKG by listing all ClaimReview URNs. Since publishers are identified by their URN prefixes (not a dedicated publisher property), this query returns all report identifiers so you can inspect the URN patterns.

Use this when users ask "what publishers are available?", "who has published reports?", or "show me all sources".

Common URN patterns to look for:
- CivicLens: `urn:civiclens:note:{topic}:{timestamp}`
- BiasLens: `urn:dkg:bias-report:{uuid}`

## Template (Parametrized)

```sparql
SELECT DISTINCT ?report WHERE {
  ?report a <http://schema.org/ClaimReview> .
}
LIMIT 100
```

## Example (Concrete)

```sparql
SELECT DISTINCT ?report WHERE {
  ?report a <http://schema.org/ClaimReview> .
}
LIMIT 100
```

## Notes

- No direct publisher property - publishers identified via URN pattern analysis
- Returns ClaimReview URN identifiers
- Inspect URN prefixes to identify publishers:
  - CivicLens reports start with `urn:civiclens:`
  - BiasLens reports start with `urn:dkg:bias-report:`
- LIMIT prevents overwhelming output with large datasets
- For filtering by specific publisher, use filter-by-publisher instead
- DISTINCT ensures each report appears only once
- Users can manually parse URNs or use filter-by-publisher for automated filtering
