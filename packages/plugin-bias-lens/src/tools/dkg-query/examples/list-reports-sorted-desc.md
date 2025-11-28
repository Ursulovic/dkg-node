# List Reports Sorted Reverse Alphabetically

**ID**: list-reports-sorted-desc
**Category**: listing
**Priority**: 7
**Keywords**: sort, reverse, descending, z-a, desc

## Description

Retrieve bias reports sorted in reverse alphabetical order (Z-A) by name. Returns reports ordered from Z to A based on the report name field. Use this when you need reports in reverse alphabetical order.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} ORDER BY DESC(?name)
```

## Example (Concrete)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} ORDER BY DESC(?name)
```

## Notes

- ORDER BY DESC() sorts results in descending order (Z-A)
- Useful for reverse alphabetical listings
- Can combine with LIMIT for reverse-order pagination
- Use ORDER BY ?name (without DESC) for standard A-Z order
