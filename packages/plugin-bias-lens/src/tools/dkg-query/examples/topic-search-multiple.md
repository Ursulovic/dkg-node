# Find Reports by Multiple Topics

**ID**: topic-search-multiple
**Category**: topic-search
**Priority**: 10
**Keywords**: multiple, topics, or, any, several

## Description

Search for bias reports matching ANY of multiple topics (OR condition). Returns reports where the article title contains any of the specified keywords. Use this when users want to find reports about multiple related topics (e.g., "find reports about Bitcoin or Ethereum or cryptocurrency").

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(
    (CONTAINS(LCASE(?name), "{{topic1}}") ||
     CONTAINS(LCASE(?name), "{{topic2}}") ||
     CONTAINS(LCASE(?name), "{{topic3}}")) &&
    CONTAINS(STR(?report), "bias-report")
  )
}
```

## Example (Concrete - Cryptocurrency Topics)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(
    (CONTAINS(LCASE(?name), "bitcoin") ||
     CONTAINS(LCASE(?name), "ethereum") ||
     CONTAINS(LCASE(?name), "cryptocurrency")) &&
    CONTAINS(STR(?report), "bias-report")
  )
}
```

## Notes

- Uses OR condition (||) to match any of the topics
- Case-insensitive matching with LCASE
- Add more topics by adding more CONTAINS clauses with || operators
- Returns reports matching at least one of the specified topics
