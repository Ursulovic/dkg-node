import wikidataProperties from '../../../../../data/wikidata/properties.json';
import wikidataConstraints from '../../../../../data/wikidata/constraints.json';
import entityTypes from '../../../../../data/wikidata/entity-types.json';
import type { WikidataProperty, PropertyConstraint, EntityClass } from '../types';

export class ConstraintValidator {
  private constraints: Map<string, PropertyConstraint[]>;

  constructor() {
    this.constraints = new Map();
    for (const constraint of wikidataConstraints as PropertyConstraint[]) {
      const existing = this.constraints.get(constraint.propertyId) || [];
      existing.push(constraint);
      this.constraints.set(constraint.propertyId, existing);
    }
  }

  validate(
    propertyId: string,
    entityId: string,
    entityType?: string,
  ): { valid: boolean; error?: string } {
    const constraints = this.constraints.get(propertyId);
    if (!constraints || constraints.length === 0) {
      return { valid: true };
    }

    for (const constraint of constraints) {
      if (
        constraint.constraintType === 'Q21503250' &&
        constraint.subjectTypes &&
        constraint.subjectTypes.length > 0
      ) {
        if (entityType && !constraint.subjectTypes.includes(entityType)) {
          const property = (wikidataProperties as WikidataProperty[]).find(
            (p) => p.id === propertyId,
          );
          const allowedTypes = constraint.subjectTypes
            .map((typeId) => {
              const type = (entityTypes as EntityClass[]).find((t) => t.id === typeId);
              return type ? `${type.label} (${typeId})` : typeId;
            })
            .join(', ');

          return {
            valid: false,
            error: `Property ${propertyId} (${property?.label || 'unknown'}) requires entity type: ${allowedTypes}. Entity ${entityId} is type ${entityType}.`,
          };
        }
      }
    }

    return { valid: true };
  }
}
