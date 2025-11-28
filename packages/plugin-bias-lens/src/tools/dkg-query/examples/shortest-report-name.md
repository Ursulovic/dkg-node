**ID**: shortest-report-name

**Category**: Analytics

**Priority**: 6

**Keywords**: shortest, minimum, length, extreme, name

# Find Report with Shortest Name

Retrieve the bias report with the shortest name. Useful for identifying reports with minimal titles or finding data quality issues.

## Template (Parametrized)

```sparql
SELECT ?report ?name (STRLEN(?name) AS ?length) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
ORDER BY ASC(STRLEN(?name))
LIMIT 1
```

## Example (Concrete)

```sparql
SELECT ?report ?name (STRLEN(?name) AS ?length) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
}
ORDER BY ASC(STRLEN(?name))
LIMIT 1
```

## Use Cases

- Finding edge cases with unusually short names
- Data quality validation
- Identifying incomplete or truncated names
- Understanding naming pattern extremes

## Returns

- `report`: UAL of the report with shortest name
- `name`: The shortest report name text
- `length`: Character count of the shortest name
