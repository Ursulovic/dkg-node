# Get First/Sample Report

**ID**: get-first-report
**Category**: listing
**Priority**: 7
**Keywords**: first, sample, example, one, single

## Description

Retrieve just one bias report as a sample or example. Returns the first available report with its UAL and name. Use this when you need a single report for testing, demonstration, or as an example.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} LIMIT 1
```

## Example (Concrete)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} LIMIT 1
```

## Notes

- Returns only one report (most efficient)
- Useful for testing and examples
- Order is not guaranteed - result may vary
- Combine with ORDER BY if specific report needed
