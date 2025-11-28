**ID**: reports-with-numbers

**Category**: Pattern-Matching

**Priority**: 6

**Keywords**: numbers, digits, regex, pattern, filter

# Find Reports with Numbers in Name

Search for bias reports whose names contain numeric digits (0-9). Useful for finding reports about years, versions, statistics, or numbered events.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
  FILTER(REGEX(?name, "[0-9]"))
}
```

## Example (Concrete)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
  FILTER(REGEX(?name, "[0-9]"))
}
```

## Use Cases

- Finding reports about specific years (e.g., "2024 election")
- Locating reports with version numbers
- Identifying reports about statistical claims
- Filtering reports with numbered references

## Returns

- `report`: UAL of each matching report
- `name`: Report name containing numeric digits
