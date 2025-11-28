# List Reports with Pagination

**ID**: list-reports-paginated
**Category**: listing
**Priority**: 7
**Keywords**: paginate, limit, first, top, page

## Description

Retrieve a limited number of bias reports for pagination. Returns the first N reports with their UALs and names. Use this when displaying reports in pages or when you only need a subset of all reports.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} LIMIT {{limit}}
```

## Example (Concrete - First 2 Reports)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} LIMIT 2
```

## Notes

- LIMIT clause restricts number of results returned
- Useful for pagination and performance optimization
- Combine with OFFSET for next page results
- Default ordering is not guaranteed - use ORDER BY if needed
