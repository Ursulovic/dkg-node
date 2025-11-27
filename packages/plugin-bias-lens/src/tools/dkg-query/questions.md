  1. Simple Count Query
  "How many bias reviews are stored in the DKG?"

  Tests: Basic schema search, COUNT aggregation, namespace awareness (http:// vs
  https://)

  2. Nested Property Traversal
  "What are the review bodies for bias reports about climate-related articles?"

  Tests: Nested object traversal (itemReviewed → url), FILTER with CONTAINS,
  following schema relationships

  3. Extension Property Discovery
  "What custom metrics are tracked on bias reviews? Show me the semantic similarity
   scores."

  Tests: discover_extensions tool usage, additionalProperty/PropertyValue pattern,
  proper field name discovery

  4. Multi-Step Aggregation
  "Which articles have been reviewed multiple times, and what were their bias 
  levels?"

  Tests: Query decomposition, GROUP BY with COUNT, joining across multiple
  properties

  5. Schema Exploration + Complex Filter
  "Find all reviews where the overall bias confidence is above 0.8 and list their 
  key patterns."

  Tests: Extension property querying (overallBiasConfidence is in
  additionalProperty), numeric filtering, array property access (keyPatterns)
