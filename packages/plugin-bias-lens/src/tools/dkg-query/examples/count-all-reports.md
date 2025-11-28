# Count All Bias Reports

**ID**: count-all-reports
**Category**: aggregation
**Priority**: 7
**Keywords**: count, total, how many, number, reports, all

## Description

Count the total number of bias reports in the DKG. This query returns a single count value showing how many bias analysis reports exist.

Use this when users ask "how many bias reports are there?" or "total number of reports".

## Template (Parametrized)

```sparql
SELECT (COUNT(DISTINCT ?report) AS ?count) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete)

```sparql
SELECT (COUNT(DISTINCT ?report) AS ?count) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
```

## Notes

- Uses DISTINCT to avoid counting duplicates
- Filters to only bias reports (not other ClaimReview types)
- Returns single aggregate value (not UALs)
- Count is returned as XML Schema integer type
