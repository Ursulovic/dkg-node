# Get Reports with Optional Fields (Multi-Publisher)

**ID**: get-report-optional-fields
**Category**: listing
**Priority**: 8
**Keywords**: multi-publisher, optional, flexible, civiclens, biaslens, all, schema-agnostic

## Description

Retrieve ClaimReview reports across ALL publishers using OPTIONAL clauses to gracefully handle different publisher schemas. This is the best practice for multi-publisher queries since different publishers use different metadata properties.

Use this when you want to list reports from all publishers without knowing their exact schemas in advance, or when different publishers might have different properties available.

CivicLens uses `topic_title`, BiasLens uses `name`, and both might have different rating structures. OPTIONAL clauses ensure the query succeeds even when some properties are missing.

## Template (Parametrized)

```sparql
SELECT ?report ?topicTitle ?name ?ratingValue WHERE {
  ?report a <http://schema.org/ClaimReview> .
  OPTIONAL { ?report <http://schema.org/topic_title> ?topicTitle } .
  OPTIONAL { ?report <http://schema.org/name> ?name } .
  OPTIONAL {
    ?report <http://schema.org/reviewRating> ?rating .
    ?rating <http://schema.org/ratingValue> ?ratingValue
  }
}
LIMIT {{limit}}
```

## Example (Concrete)

```sparql
SELECT ?report ?topicTitle ?name ?ratingValue WHERE {
  ?report a <http://schema.org/ClaimReview> .
  OPTIONAL { ?report <http://schema.org/topic_title> ?topicTitle } .
  OPTIONAL { ?report <http://schema.org/name> ?name } .
  OPTIONAL {
    ?report <http://schema.org/reviewRating> ?rating .
    ?rating <http://schema.org/ratingValue> ?ratingValue
  }
}
LIMIT 20
```

## Notes

- OPTIONAL clauses allow properties to be missing without failing the query
- Different publishers will populate different optional fields:
  - CivicLens reports typically have `topic_title` but not `name`
  - BiasLens reports typically have `name` but not `topic_title`
- Variables with no binding return as unbound (empty) in results
- Best practice for schema-agnostic multi-publisher queries
- Can combine with FILTER to restrict to specific publishers if needed
- Use LIMIT to manage result size when querying all publishers
- For publisher-specific queries with known schemas, non-OPTIONAL queries are more efficient
