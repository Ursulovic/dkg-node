# List Reports Sorted Alphabetically

**ID**: list-reports-sorted
**Category**: listing
**Priority**: 7
**Keywords**: sort, alphabetical, order, sorted

## Description

Retrieve bias reports sorted alphabetically by name. Returns reports ordered from A-Z based on the report name field. Use this when you need an organized list of reports in alphabetical order.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} ORDER BY ?name
```

## Example (Concrete)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} ORDER BY ?name
```

## Notes

- ORDER BY clause sorts results alphabetically
- Default sort is ascending (A-Z)
- Use ORDER BY DESC(?name) for reverse alphabetical (Z-A)
- Can combine with LIMIT for paginated alphabetical listing
