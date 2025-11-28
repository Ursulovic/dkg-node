# Find Reports Ending with Specific Text

**ID**: topic-search-ends-with
**Category**: topic-search
**Priority**: 8
**Keywords**: ends with, suffix, ending, regex anchor

## Description

Search for bias reports where the name ends with specific text using REGEX with end anchor ($). Use this when you need reports that end with a particular suffix (before the closing quote).

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(REGEX(?name, "{{suffix}}$", "i") && CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete - Names ending with "pandemic")

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(REGEX(?name, "pandemic$", "i") && CONTAINS(STR(?report), "bias-report"))
}
```

## Notes

- $ anchor matches the end of the value (before closing quote)
- Pattern "pandemic$" matches names ending with "pandemic"
- Third parameter "i" makes matching case-insensitive
- Use "change$" for more specific suffix matching
- Combine with ORDER BY for organized results
- More precise than CONTAINS() for suffix matching
