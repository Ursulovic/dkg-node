# Find Reports by Topic Using Regular Expressions

**ID**: topic-search-regex
**Category**: topic-search
**Priority**: 9
**Keywords**: regex, pattern, wildcard, regular expression, advanced search

## Description

Search for bias reports using regular expression patterns for advanced topic matching. Supports OR conditions (|), wildcards (.*), character classes ([]), and more. Use this when you need flexible pattern matching beyond simple substring searches.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(REGEX(?name, "{{pattern}}", "i") && CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete - Match COVID or climate)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(REGEX(?name, "COVID|climate", "i") && CONTAINS(STR(?report), "bias-report"))
}
```

## Notes

- REGEX() function supports full regular expression syntax
- Third parameter "i" makes pattern case-insensitive
- Pattern "COVID|climate" matches either COVID OR climate
- Pattern "Bitcoin.*analysis" matches Bitcoin followed by analysis
- Pattern "^Bias" matches names starting with "Bias"
- Pattern "pandemic$" matches names ending with "pandemic"
- More powerful than CONTAINS() for complex pattern matching
- Can combine with ORDER BY, LIMIT for organized results
