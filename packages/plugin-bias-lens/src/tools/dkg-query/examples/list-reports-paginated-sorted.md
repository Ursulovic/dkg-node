# List Reports with Pagination and Sorting

**ID**: list-reports-paginated-sorted
**Category**: listing
**Priority**: 8
**Keywords**: paginate, limit, sorted, order, page

## Description

Retrieve a limited number of bias reports sorted alphabetically. Combines pagination with alphabetical ordering for organized, page-by-page results. Use this when displaying sorted reports in pages or when you need a subset of results in a specific order.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} ORDER BY ?name LIMIT {{limit}}
```

## Example (Concrete - First 2 Reports Alphabetically)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} ORDER BY ?name LIMIT 2
```

## Notes

- Combines LIMIT and ORDER BY clauses
- Returns first N results in alphabetical order
- Use ORDER BY DESC(?name) for reverse alphabetical pagination
- Combine with OFFSET for next page results (e.g., LIMIT 10 OFFSET 10 for page 2)
- Useful for implementing sorted, paginated UI displays
