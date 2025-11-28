# Count Reports Matching Specific Topic

**ID**: count-by-topic
**Category**: aggregation
**Priority**: 8
**Keywords**: count, filter, topic, analytics, statistics

## Description

Count how many bias reports match a specific topic or keyword. Returns a single count value showing the number of reports containing the search term. Use this for analytics and statistics about topic coverage.

## Template (Parametrized)

```sparql
SELECT (COUNT(?report) AS ?count) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(LCASE(?name), "{{topic}}") && CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete - Count COVID-related reports)

```sparql
SELECT (COUNT(?report) AS ?count) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(LCASE(?name), "covid") && CONTAINS(STR(?report), "bias-report"))
}
```

## Notes

- Returns single numeric count value
- Combines topic filtering with aggregation
- Use CONTAINS(LCASE(?name), "topic") for case-insensitive matching
- Can use OR conditions for multiple topics: (CONTAINS(..., "topic1") || CONTAINS(..., "topic2"))
- Use REGEX() for more complex pattern matching before counting
- Useful for analytics dashboards and statistics
