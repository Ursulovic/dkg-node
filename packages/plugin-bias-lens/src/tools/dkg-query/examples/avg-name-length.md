**ID**: avg-name-length

**Category**: Analytics

**Priority**: 6

**Keywords**: average, length, analytics, statistics, name

# Calculate Average Report Name Length

Calculate the average character length of all bias report names. Useful for understanding typical report naming conventions and identifying outliers.

## Template (Parametrized)

```sparql
SELECT (AVG(STRLEN(?name)) AS ?avgLength) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete)

```sparql
SELECT (AVG(STRLEN(?name)) AS ?avgLength) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
```

## Use Cases

- Understanding typical report name length
- Identifying naming conventions
- Analytics dashboards showing report statistics
- Data quality checks for name fields

## Returns

- `avgLength`: Average character count across all report names (decimal number)
