# List All Available Topics

**ID**: list-all-topics
**Category**: topic-discovery
**Priority**: 9
**Keywords**: topics, list, discover, available, civiclens, category, subjects, what topics

## Description

List all available topics that have been analyzed, along with the number of reports for each topic. This query uses the CivicLens schema properties (topic_id, topic_title) to discover what subjects are covered in the DKG.

Use this when users ask "what topics are available?", "show me all subjects", or "what has been analyzed?".

This query is specific to publishers that use the topic_id/topic_title schema pattern (like CivicLens).

## Template (Parametrized)

```sparql
SELECT DISTINCT ?topicId ?topicTitle (COUNT(?report) AS ?reportCount) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/topic_id> ?topicId .
  ?report <http://schema.org/topic_title> ?topicTitle .
}
GROUP BY ?topicId ?topicTitle
ORDER BY DESC(?reportCount)
```

## Example (Concrete)

```sparql
SELECT DISTINCT ?topicId ?topicTitle (COUNT(?report) AS ?reportCount) WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/topic_id> ?topicId .
  ?report <http://schema.org/topic_title> ?topicTitle .
}
GROUP BY ?topicId ?topicTitle
ORDER BY DESC(?reportCount)
```

## Notes

- Uses CivicLens schema: topic_id and topic_title properties
- Results are sorted by report count (most analyzed topics first)
- GROUP BY ensures each topic appears only once
- Returns topic identifiers, human-readable titles, and counts
- Will not return topics from publishers that don't use this schema
- For BiasLens reports, use topic-search-by-name instead (searches in report names)
