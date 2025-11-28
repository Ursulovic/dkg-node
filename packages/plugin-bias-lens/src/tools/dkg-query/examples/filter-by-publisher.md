# Filter Reports by Publisher

**ID**: filter-by-publisher
**Category**: publisher-filter
**Priority**: 8
**Keywords**: publisher, filter, source, civiclens, biaslens, urn, from, by

## Description

Filter ClaimReview reports by specific publisher using URN pattern matching. Since publishers are identified by their URN prefixes (not a dedicated publisher property), we use FILTER with CONTAINS to match URN patterns.

Use this when users ask "show me reports from CivicLens", "what did BiasLens publish?", or "filter by publisher X".

## Template (Parametrized)

```sparql
SELECT ?report ?topicTitle WHERE {
  ?report a <http://schema.org/ClaimReview> .
  OPTIONAL { ?report <http://schema.org/topic_title> ?topicTitle }
  FILTER(CONTAINS(STR(?report), "{{urn_pattern}}"))
}
LIMIT 20
```

## Example (Concrete - CivicLens)

```sparql
SELECT ?report ?topicTitle WHERE {
  ?report a <http://schema.org/ClaimReview> .
  OPTIONAL { ?report <http://schema.org/topic_title> ?topicTitle }
  FILTER(CONTAINS(STR(?report), "urn:civiclens"))
}
LIMIT 20
```

## Example (Concrete - BiasLens)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  OPTIONAL { ?report <http://schema.org/name> ?name }
  FILTER(CONTAINS(STR(?report), "urn:dkg:bias-report"))
}
LIMIT 20
```

## Notes

- Publisher identification via URN prefix matching
- Known URN patterns:
  - CivicLens: `urn:civiclens:note:{topic}:{timestamp}`
  - BiasLens: `urn:dkg:bias-report:{uuid}`
- Uses OPTIONAL for topic_title/name since different publishers have different schemas
- FILTER on STR(?report) converts URN to string for pattern matching
- Case-sensitive matching (use exact URN prefix)
- For discovering publishers, use list-publishers instead
