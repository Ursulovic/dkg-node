# Find Reports by Topic (Article Title)

**ID**: topic-search-by-name
**Category**: topic-search
**Priority**: 10
**Keywords**: topic, subject, article, title, name, search

## Description

Search for bias reports by article topic using the report name field. Since bias report names follow the pattern "Bias Analysis: {Article Title}", you can search for reports about specific topics by matching against the name field. This is the most reliable way to find reports by topic.

Use this query when users ask "find bias reports about X" or "show me reports on topic Y".

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(LCASE(?name), "{{topic}}") && CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete - Bitcoin)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(LCASE(?name), "bitcoin") && CONTAINS(STR(?report), "bias-report"))
}
```

## Notes

- Uses case-insensitive search (LCASE) for robustness
- Filters to only bias reports (not other ClaimReview types)
- Returns UAL (?report) for tokenomics integration
- The {{topic}} placeholder should be lowercase in the filter
