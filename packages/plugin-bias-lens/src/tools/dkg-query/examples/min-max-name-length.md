**ID**: min-max-name-length

**Category**: Analytics

**Priority**: 6

**Keywords**: minimum, maximum, range, length, statistics

# Get Min and Max Name Lengths

Calculate both the shortest and longest name lengths across all bias reports in a single query. Useful for understanding the range of name field values.

## Template (Parametrized)

```sparql
SELECT (MIN(STRLEN(?name)) AS ?minLength) (MAX(STRLEN(?name)) AS ?maxLength) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete)

```sparql
SELECT (MIN(STRLEN(?name)) AS ?minLength) (MAX(STRLEN(?name)) AS ?maxLength) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
```

## Use Cases

- Understanding name length range at a glance
- Data quality validation checks
- Setting UI field constraints based on actual data
- Analytics dashboards showing data ranges

## Returns

- `minLength`: Shortest name length in characters
- `maxLength`: Longest name length in characters
