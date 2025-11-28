**ID**: longest-report-name

**Category**: Analytics

**Priority**: 6

**Keywords**: longest, maximum, length, extreme, name

# Find Report with Longest Name

Retrieve the bias report with the longest name. Useful for identifying reports with exceptionally long titles or finding edge cases in name field handling.

## Template (Parametrized)

```sparql
SELECT ?report ?name (STRLEN(?name) AS ?length) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
ORDER BY DESC(STRLEN(?name))
LIMIT 1
```

## Example (Concrete)

```sparql
SELECT ?report ?name (STRLEN(?name) AS ?length) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
ORDER BY DESC(STRLEN(?name))
LIMIT 1
```

## Use Cases

- Finding edge cases with unusually long names
- Data quality validation
- UI testing with maximum length names
- Understanding naming pattern extremes

## Returns

- `report`: UAL of the report with longest name
- `name`: The longest report name text
- `length`: Character count of the longest name
