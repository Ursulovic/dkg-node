import { PropertyResolver } from './resolvers/property-resolver';
import { ConstraintValidator } from './resolvers/constraint-validator';
import { EntityTypeResolver } from './resolvers/entity-type-resolver';
import { buildSparqlQuery } from './query/builder';
import { executeSparql } from './query/executor';
import { parseWikidataResponse } from './query/parser';
import { resolveEntity } from './utils/entity-utils';
import type { WikidataQueryInput, WikidataQueryResult } from './types';

const propertyResolver = new PropertyResolver();
const constraintValidator = new ConstraintValidator();
const entityTypeResolver = new EntityTypeResolver();

export async function wikidataQueryHandler(input: WikidataQueryInput): Promise<WikidataQueryResult> {
  try {
    const entity = await resolveEntity(input.entity);
    if (!entity) {
      return {
        success: false,
        error: `Entity "${input.entity}" not found in Wikidata.`,
      };
    }

    const property = await propertyResolver.findPropertyWithFallback(input.property);
    if (!property) {
      return {
        success: false,
        error: `Property "${input.property}" not found.`,
      };
    }

    const entityType = await entityTypeResolver.resolveEntityType(entity.entityId);
    if (entityType) {
      const validation = constraintValidator.validate(property.id, entity.entityId, entityType);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error || 'Constraint validation failed.',
        };
      }
    }

    const sparqlQuery = buildSparqlQuery(entity.entityId, property.id);
    const sparqlResult = await executeSparql(sparqlQuery);

    if (!sparqlResult) {
      return {
        success: false,
        error: 'SPARQL query failed to execute.',
      };
    }

    const data = parseWikidataResponse(sparqlResult, entity.entityId, property.label);

    if (!data) {
      return {
        success: false,
        error: `No data available for property "${property.label}" on entity "${entity.label}".`,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred.',
    };
  }
}
