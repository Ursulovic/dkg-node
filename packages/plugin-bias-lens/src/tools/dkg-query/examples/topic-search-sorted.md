# Find Reports by Topic Sorted Alphabetically

**ID**: topic-search-sorted
**Category**: topic-search
**Priority**: 9
**Keywords**: topic, keyword, search, sorted, alphabetical, ordered

## Description

Search for bias reports matching specific topics and return results sorted alphabetically. Combines topic filtering with alphabetical ordering. Use this when you need topic-specific results in an organized, sorted format.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(LCASE(?name), "{{topic}}") && CONTAINS(STR(?report), "bias-report"))
} ORDER BY ?name
```

## Example (Concrete - Search for "analysis")

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(LCASE(?name), "analysis") && CONTAINS(STR(?report), "bias-report"))
} ORDER BY ?name
```

## Notes

- Combines topic filtering with alphabetical sorting
- Results ordered A-Z by report name
- Use ORDER BY DESC(?name) for reverse alphabetical order
- Can combine with LIMIT for paginated sorted results
- Multiple topics can use OR conditions: (CONTAINS(LCASE(?name), "topic1") || CONTAINS(LCASE(?name), "topic2"))
