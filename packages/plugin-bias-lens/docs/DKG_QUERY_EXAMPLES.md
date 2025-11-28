# DKG Query Examples

This document provides working SPARQL query examples for querying bias reports in the OriginTrail DKG.

## Overview

The DKG contains bias reports from multiple publishers (CivicLens, BiasLens, etc.). Each publisher may use slightly different schemas, so queries need to account for variations.

## Known Publishers & Schemas

### CivicLens
- **URN Pattern**: `urn:civiclens:note:{topic}:{timestamp}`
- **Properties**:
  - `topic_id`: Topic identifier (e.g., "moon", "climate")
  - `topic_title`: Human-readable topic name
  - `claimReviewed`: Description of what was reviewed
  - `reviewRating`: UUID reference to Rating object
    - `ratingValue`: Numeric score (scale varies)
    - `bestRating`: 5
    - `worstRating`: 0
    - `ratingExplanation`: Text explanation

### BiasLens (Your Plugin)
- **URN Pattern**: `urn:dkg:bias-report:{uuid}`
- **Properties**:
  - `name`: Report title
  - `itemReviewed`: Reference to reviewed article
    - `url`: Article URL
  - `publisher`: Publisher information
    - `name`: Publisher name
    - `url`: Publisher URL
  - `reviewRating`: Rating object
    - `ratingValue`: 1-5 scale (1=severe, 5=none)
  - `keywords`: Array of bias patterns
  - `datePublished`: ISO 8601 timestamp

## Query Examples

### 1. Count All Bias Reports

Count total number of bias reports across all publishers:

\`\`\`sparql
SELECT (COUNT(DISTINCT ?report) AS ?totalReports)
WHERE {
  ?report a <http://schema.org/ClaimReview> .
}
\`\`\`

**Usage**:
\`\`\`bash
npm run sparql -- --query 'SELECT (COUNT(DISTINCT ?report) AS ?totalReports) WHERE { ?report a <http://schema.org/ClaimReview> }' --format table
\`\`\`

### 2. List All Available Topics

Find all topics that have been analyzed:

\`\`\`sparql
SELECT DISTINCT ?topicId ?topicTitle (COUNT(?report) AS ?reportCount)
WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/topic_id> ?topicId .
  ?report <http://schema.org/topic_title> ?topicTitle .
}
GROUP BY ?topicId ?topicTitle
ORDER BY DESC(?reportCount)
\`\`\`

**Usage**:
\`\`\`bash
npm run sparql -- --query 'SELECT DISTINCT ?topicId ?topicTitle (COUNT(?report) AS ?reportCount) WHERE { ?report a <http://schema.org/ClaimReview> . ?report <http://schema.org/topic_id> ?topicId . ?report <http://schema.org/topic_title> ?topicTitle } GROUP BY ?topicId ?topicTitle ORDER BY DESC(?reportCount)' --format table
\`\`\`

### 3. Find Reports by Topic

Get all reports about a specific topic (e.g., "moon"):

\`\`\`sparql
SELECT ?report ?topicTitle ?claimReviewed
WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/topic_id> "moon" .
  ?report <http://schema.org/topic_title> ?topicTitle .
  ?report <http://schema.org/claimReviewed> ?claimReviewed .
}
LIMIT 20
\`\`\`

**Usage**:
\`\`\`bash
npm run sparql -- --query 'SELECT ?report ?topicTitle ?claimReviewed WHERE { ?report a <http://schema.org/ClaimReview> . ?report <http://schema.org/topic_id> "moon" . ?report <http://schema.org/topic_title> ?topicTitle . ?report <http://schema.org/claimReviewed> ?claimReviewed } LIMIT 20' --format table
\`\`\`

### 4. Filter by Publisher (URN Pattern)

Get reports from CivicLens only:

\`\`\`sparql
SELECT ?report ?topicTitle
WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/topic_title> ?topicTitle .
  FILTER(CONTAINS(STR(?report), "urn:civiclens"))
}
LIMIT 20
\`\`\`

Get reports from BiasLens only:

\`\`\`sparql
SELECT ?report ?name
WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/name> ?name .
  FILTER(CONTAINS(STR(?report), "urn:dkg:bias-report"))
}
LIMIT 20
\`\`\`

**Usage**:
\`\`\`bash
# CivicLens
npm run sparql -- --query 'SELECT ?report ?topicTitle WHERE { ?report a <http://schema.org/ClaimReview> . ?report <http://schema.org/topic_title> ?topicTitle . FILTER(CONTAINS(STR(?report), "urn:civiclens")) } LIMIT 20' --format table

# BiasLens
npm run sparql -- --query 'SELECT ?report ?name WHERE { ?report a <http://schema.org/ClaimReview> . ?report <http://schema.org/name> ?name . FILTER(CONTAINS(STR(?report), "urn:dkg:bias-report")) } LIMIT 20' --format table
\`\`\`

### 5. Get Full Report with Rating

Get complete report details including rating:

\`\`\`sparql
SELECT ?report ?topicTitle ?claimReviewed ?ratingValue ?ratingExplanation
WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/topic_title> ?topicTitle .
  ?report <http://schema.org/claimReviewed> ?claimReviewed .
  ?report <http://schema.org/reviewRating> ?rating .
  ?rating <http://schema.org/ratingValue> ?ratingValue .
  ?rating <http://schema.org/ratingExplanation> ?ratingExplanation .
}
LIMIT 10
\`\`\`

**Usage**:
\`\`\`bash
npm run sparql -- --query 'SELECT ?report ?topicTitle ?claimReviewed ?ratingValue ?ratingExplanation WHERE { ?report a <http://schema.org/ClaimReview> . ?report <http://schema.org/topic_title> ?topicTitle . ?report <http://schema.org/claimReviewed> ?claimReviewed . ?report <http://schema.org/reviewRating> ?rating . ?rating <http://schema.org/ratingValue> ?ratingValue . ?rating <http://schema.org/ratingExplanation> ?ratingExplanation } LIMIT 10' --format table
\`\`\`

### 6. Filter by Rating Value

Find reports with specific rating criteria:

\`\`\`sparql
SELECT ?report ?topicTitle ?ratingValue ?ratingExplanation
WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/topic_title> ?topicTitle .
  ?report <http://schema.org/reviewRating> ?rating .
  ?rating <http://schema.org/ratingValue> ?ratingValue .
  ?rating <http://schema.org/ratingExplanation> ?ratingExplanation .
  FILTER(xsd:integer(?ratingValue) < 0)
}
LIMIT 20
\`\`\`

**Usage**:
\`\`\`bash
npm run sparql -- --query 'SELECT ?report ?topicTitle ?ratingValue ?ratingExplanation WHERE { ?report a <http://schema.org/ClaimReview> . ?report <http://schema.org/topic_title> ?topicTitle . ?report <http://schema.org/reviewRating> ?rating . ?rating <http://schema.org/ratingValue> ?ratingValue . ?rating <http://schema.org/ratingExplanation> ?ratingExplanation . FILTER(xsd:integer(?ratingValue) < 0) } LIMIT 20' --format table
\`\`\`

### 7. Get Specific Report by URN

Retrieve all properties of a specific report:

\`\`\`sparql
SELECT ?property ?value
WHERE {
  <urn:civiclens:note:moon:2025-11-15T01:52:05.891Z> ?property ?value .
}
LIMIT 50
\`\`\`

**Usage**:
\`\`\`bash
npm run sparql -- --query 'SELECT ?property ?value WHERE { <urn:civiclens:note:moon:2025-11-15T01:52:05.891Z> ?property ?value } LIMIT 50' --format table
\`\`\`

### 8. List All Publishers

Extract publisher identifiers from URNs:

\`\`\`sparql
SELECT DISTINCT ?report
WHERE {
  ?report a <http://schema.org/ClaimReview> .
}
LIMIT 100
\`\`\`

**Note**: Publisher identification is done via URN pattern matching:
- `urn:civiclens:*` → CivicLens
- `urn:dkg:bias-report:*` → BiasLens
- Extract publisher by parsing the URN prefix

**Usage**:
\`\`\`bash
npm run sparql -- --query 'SELECT DISTINCT ?report WHERE { ?report a <http://schema.org/ClaimReview> } LIMIT 100' --format table
\`\`\`

### 9. Search by Topic Keyword

Find topics matching a keyword (case-insensitive):

\`\`\`sparql
SELECT DISTINCT ?report ?topicTitle
WHERE {
  ?report a <http://schema.org/ClaimReview> .
  ?report <http://schema.org/topic_title> ?topicTitle .
  FILTER(CONTAINS(LCASE(?topicTitle), "climate"))
}
LIMIT 20
\`\`\`

**Usage**:
\`\`\`bash
npm run sparql -- --query 'SELECT DISTINCT ?report ?topicTitle WHERE { ?report a <http://schema.org/ClaimReview> . ?report <http://schema.org/topic_title> ?topicTitle . FILTER(CONTAINS(LCASE(?topicTitle), "climate")) } LIMIT 20' --format table
\`\`\`

### 10. Aggregate Statistics

Get statistical overview of all reports:

\`\`\`sparql
SELECT
  (COUNT(DISTINCT ?report) AS ?totalReports)
  (COUNT(DISTINCT ?topic) AS ?uniqueTopics)
  (AVG(xsd:integer(?ratingValue)) AS ?avgRating)
WHERE {
  ?report a <http://schema.org/ClaimReview> .
  OPTIONAL { ?report <http://schema.org/topic_id> ?topic }
  OPTIONAL {
    ?report <http://schema.org/reviewRating> ?rating .
    ?rating <http://schema.org/ratingValue> ?ratingValue .
  }
}
\`\`\`

**Usage**:
\`\`\`bash
npm run sparql -- --query 'SELECT (COUNT(DISTINCT ?report) AS ?totalReports) (COUNT(DISTINCT ?topic) AS ?uniqueTopics) (AVG(xsd:integer(?ratingValue)) AS ?avgRating) WHERE { ?report a <http://schema.org/ClaimReview> . OPTIONAL { ?report <http://schema.org/topic_id> ?topic } OPTIONAL { ?report <http://schema.org/reviewRating> ?rating . ?rating <http://schema.org/ratingValue> ?ratingValue } }' --format table
\`\`\`

## Tips

1. **Always use LIMIT**: DKG queries can return large result sets. Always add `LIMIT` to avoid timeouts
2. **Test incrementally**: Start with simple queries and add complexity gradually
3. **Use OPTIONAL**: Different publishers use different schemas - use `OPTIONAL` for properties that may not exist
4. **Filter by URN**: Publisher identification is done via URN pattern matching
5. **Format output**: Use `--format table` for readable output, `--format json` for programmatic use

## Troubleshooting

### Query Timeout
- Reduce the scope with LIMIT
- Add more specific filters
- Break complex queries into simpler ones

### No Results
- Check if the property exists in the schema (different publishers use different properties)
- Use OPTIONAL for properties that might not exist
- Verify URN patterns match actual data

### 500 Error
- Query syntax may be invalid
- Query may be too complex for the endpoint
- Try simplifying the query
