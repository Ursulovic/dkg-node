# Find Reports by Topic ID

**ID**: filter-by-topic-id
**Category**: topic-search
**Priority**: 9
**Keywords**: topic, filter, search, specific, civiclens, subject, about

## Description

Search for reports about a specific topic using the topic_id property. This query uses the CivicLens schema to filter reports by topic identifier.

Use this when users ask "find reports about X", "show me reports on Y", or "what reports cover Z topic".

This query is specific to publishers that use the topic_id schema pattern (like CivicLens). For BiasLens reports, use topic-search-by-name instead.

## Template (Parametrized)

```sparql
SELECT ?report ?topicTitle WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/topic_id> "{{topic}}" .
  ?report <http://schema.org/topic_title> ?topicTitle .
}
LIMIT 20
```

## Example (Concrete - Moon)

```sparql
SELECT ?report ?topicTitle WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/topic_id> "moon" .
  ?report <http://schema.org/topic_title> ?topicTitle .
}
LIMIT 20
```

## Notes

- Uses CivicLens schema: topic_id property for exact matching
- topic_id values are lowercase (e.g., "moon", "climate", "bitcoin")
- Returns report URNs and human-readable topic titles
- Use LIMIT to avoid large result sets
- For partial matching or BiasLens reports, use topic-search-by-name with CONTAINS
- The {{topic}} placeholder should be lowercase
