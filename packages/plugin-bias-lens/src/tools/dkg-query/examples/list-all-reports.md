# List All Bias Reports

**ID**: list-all-reports
**Category**: listing
**Priority**: 7
**Keywords**: list, all, show, reports, browse

## Description

Retrieve all bias report UALs and names from the DKG. Returns a list of all available bias analysis reports with their unique identifiers and titles. Use this when users ask to "list all reports" or "show me all bias analyses".

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
```

## Notes

- Returns all bias reports (no filtering)
- Includes both UAL (?report) for tokenomics and name for display
- Use LIMIT clause if you want to paginate results
- Names follow pattern: "Bias Analysis: {Article Title}"
