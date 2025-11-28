# List All Report UALs

**ID**: list-report-uals
**Category**: listing
**Priority**: 7
**Keywords**: list, uals, ids, identifiers, reports

## Description

Retrieve only the UALs (Universal Asset Locators) of all bias reports, without fetching additional fields. This is the most efficient query for getting report identifiers. Use this when you only need the list of report IDs without names or other metadata.

## Template (Parametrized)

```sparql
SELECT ?report WHERE {
  ?report a <http://schema.org/ClaimReview> .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete)

```sparql
SELECT ?report WHERE {
  ?report a <http://schema.org/ClaimReview> .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
```

## Notes

- Most efficient query - only returns UALs
- Perfect for tokenomics operations that only need identifiers
- Filter ensures only bias reports are returned (not other ClaimReview types)
- Use as basis for batch operations on multiple reports
