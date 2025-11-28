# Get Specific Report by UAL

**ID**: get-report-by-ual
**Category**: retrieval
**Priority**: 5
**Keywords**: get, fetch, retrieve, ual, id, specific

## Description

Retrieve a specific bias report's name using its UAL (Universal Asset Locator). Use this when you have the exact report identifier and want to fetch its details. This is the most direct way to access a known report.

## Template (Parametrized)

```sparql
SELECT ?name WHERE {
  <{{ual}}> a <http://schema.org/ClaimReview> .
  <{{ual}}> <http://schema.org/name> ?name .
}
```

## Example (Concrete - Bitcoin Report)

```sparql
SELECT ?name WHERE {
  <urn:dkg:bias-report:ae20f192-4810-494e-8592-3f46241ec9c6> a <http://schema.org/ClaimReview> .
  <urn:dkg:bias-report:ae20f192-4810-494e-8592-3f46241ec9c6> <http://schema.org/name> ?name .
}
```

## Notes

- Replace {{ual}} with the actual report UAL
- UAL must be in format: `urn:dkg:bias-report:{uuid}`
- Returns empty result if UAL doesn't exist or isn't a bias report
- Can extend to retrieve other fields by adding more predicates
