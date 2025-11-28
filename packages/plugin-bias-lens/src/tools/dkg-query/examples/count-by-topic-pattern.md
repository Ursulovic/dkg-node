# Count Reports by Topic Pattern

**ID**: count-by-topic-pattern
**Category**: aggregation
**Priority**: 7
**Keywords**: group, count, topics, distribution, breakdown

## Description

Count how many reports match different topic patterns using GROUP BY. This gives a breakdown of report distribution across different subjects. Use this to see which topics have the most bias analysis coverage.

## Template (Parametrized)

```sparql
SELECT ?name (COUNT(?report) AS ?count) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} GROUP BY ?name
```

## Example (Concrete)

```sparql
SELECT ?name (COUNT(?report) AS ?count) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
} GROUP BY ?name
```

## Notes

- Groups reports by their name field
- Returns count for each unique report name
- Useful for finding duplicate reports or seeing topic distribution
- Can be combined with ORDER BY ?count DESC to find most common topics
