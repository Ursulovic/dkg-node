# Find Reports Starting with Specific Text

**ID**: topic-search-starts-with
**Category**: topic-search
**Priority**: 8
**Keywords**: starts with, prefix, beginning, regex anchor

## Description

Search for bias reports where the name starts with specific text using REGEX with start anchor (^). Use this when you need reports that begin with a particular prefix rather than containing it anywhere.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(REGEX(?name, "^{{prefix}}", "i") && CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete - Names starting with "Bias")

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(REGEX(?name, "^Bias", "i") && CONTAINS(STR(?report), "bias-report"))
}
```

## Notes

- ^ anchor matches the beginning of the value (after opening quote)
- Pattern "^Bias" matches names starting with "Bias"
- Third parameter "i" makes matching case-insensitive
- Use "^Bias Analysis:" for more specific prefix matching
- Combine with ORDER BY for organized results
- More precise than CONTAINS() for prefix matching
