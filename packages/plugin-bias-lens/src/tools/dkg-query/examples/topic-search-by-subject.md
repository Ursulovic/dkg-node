# Find Reports About Specific Subjects

**ID**: topic-search-by-subject
**Category**: topic-search
**Priority**: 10
**Keywords**: subject, domain, category, field, area

## Description

Search for bias reports about specific subject areas or domains (e.g., health, politics, economics, technology). Matches against the article title in the report name. Use this when users ask about reports in a particular subject category.

## Template (Parametrized)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(LCASE(?name), "{{subject}}") && CONTAINS(STR(?report), "bias-report"))
}
```

## Example (Concrete - Health/Medical Topics)

```sparql
SELECT ?report ?name WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(
    (CONTAINS(LCASE(?name), "health") ||
     CONTAINS(LCASE(?name), "medical") ||
     CONTAINS(LCASE(?name), "disease") ||
     CONTAINS(LCASE(?name), "pandemic")) &&
    CONTAINS(STR(?report), "bias-report")
  )
}
```

## Notes

- Searches article titles for subject-related keywords
- Uses OR conditions for multiple related keywords in a domain
- Case-insensitive matching for broader coverage
- Customize subject keywords based on domain of interest
