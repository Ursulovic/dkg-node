import type { SparqlResult, WikidataQueryResult } from '../types';

export function parseWikidataResponse(
  sparqlResult: SparqlResult,
  entityId: string,
  propertyLabel: string,
): WikidataQueryResult['data'] | null {
  if (!sparqlResult.results.bindings || sparqlResult.results.bindings.length === 0) {
    return null;
  }

  const binding = sparqlResult.results.bindings[0];
  if (!binding || !binding.value) {
    return null;
  }

  const valueBinding = binding.value;
  let value: string | number;

  if (valueBinding.datatype === 'http://www.w3.org/2001/XMLSchema#integer') {
    value = parseInt(valueBinding.value, 10);
  } else if (valueBinding.datatype === 'http://www.w3.org/2001/XMLSchema#decimal') {
    value = parseFloat(valueBinding.value);
  } else if (valueBinding.value.startsWith('http://www.wikidata.org/entity/')) {
    const parts = valueBinding.value.split('/');
    const entityId = parts[parts.length - 1];
    const label = binding.valueLabel?.value;
    value = label || entityId || valueBinding.value;
  } else if (
    valueBinding.datatype &&
    valueBinding.datatype.includes('XMLSchema#date')
  ) {
    const date = new Date(valueBinding.value);
    value = date.toISOString().split('T')[0] || valueBinding.value;
  } else {
    value = valueBinding.value;
  }

  return {
    property: propertyLabel,
    value,
    wikidataEntityId: entityId,
    wikidataUrl: `https://www.wikidata.org/wiki/${entityId}`,
    references: [],
  };
}
