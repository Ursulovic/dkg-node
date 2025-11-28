# Count All ClaimReview Reports (Multi-Publisher)

**ID**: count-all-claim-reviews
**Category**: aggregation
**Priority**: 10
**Keywords**: count, total, all, publishers, cross-publisher, multi-publisher, civiclens, biaslens, how many

## Description

Count the total number of ClaimReview reports in the DKG across ALL publishers. This query returns a single count value showing all bias analysis reports from CivicLens, BiasLens, and any other publishers.

Use this when users ask "how many reports are there in total?" or "count all bias reports from all sources".

This is the multi-publisher version of count-all-reports. Use this when you want to include reports from ALL publishers, not just BiasLens.

## Template (Parametrized)

```sparql
SELECT (COUNT(DISTINCT ?report) AS ?totalReports) WHERE {
  ?report a <http://schema.org/ClaimReview> .
}
```

## Example (Concrete)

```sparql
SELECT (COUNT(DISTINCT ?report) AS ?totalReports) WHERE {
  ?report a <http://schema.org/ClaimReview> .
}
```

## Notes

- No FILTER clause - includes ALL ClaimReview entities regardless of publisher
- Works across CivicLens (urn:civiclens), BiasLens (urn:dkg:bias-report), and any other publishers
- Uses DISTINCT to avoid counting duplicates
- Returns single aggregate value (not URNs)
- Count is returned as XML Schema integer type
- For BiasLens-only count, use count-all-reports instead
