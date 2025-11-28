**ID**: reports-with-special-chars

**Category**: Pattern-Matching

**Priority**: 6

**Keywords**: punctuation, special characters, regex, pattern, filter

# Find Reports with Special Characters

Search for bias reports whose names contain special punctuation characters. Useful for finding reports with questions, emphatic statements, or specific formatting.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
  FILTER(REGEX(?name, "[?,.:;]"))
}
```

## Example (Concrete)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "bias-report"))
  FILTER(REGEX(?name, "[?,.:;]"))
}
```

## Use Cases

- Finding reports framed as questions (containing "?")
- Identifying formally structured titles with colons
- Locating reports with comma-separated lists
- Pattern analysis of naming conventions

## Returns

- `report`: UAL of each matching report
- `name`: Report name containing special punctuation
