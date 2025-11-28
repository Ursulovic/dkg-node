# List Reports with Pagination Offset

**ID**: list-reports-with-offset
**Category**: listing
**Priority**: 7
**Keywords**: paginate, offset, skip, page, next

## Description

Retrieve bias reports with pagination offset to skip a specified number of results. Used for implementing true pagination where you need page 2, page 3, etc. Combine with LIMIT to control page size.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} ORDER BY ?name LIMIT {{limit}} OFFSET {{offset}}
```

## Example (Concrete - Second Page, 1 Per Page)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} ORDER BY ?name LIMIT 1 OFFSET 1
```

## Notes

- OFFSET skips the first N results
- LIMIT controls how many results to return after skipping
- Formula: OFFSET = (page_number - 1) * page_size
- Example: Page 3 with 10 per page = LIMIT 10 OFFSET 20
- Combine with ORDER BY for consistent pagination
- Without ORDER BY, pagination order may vary between queries
