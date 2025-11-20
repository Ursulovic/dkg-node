import entityTypes from '../../../../../data/wikidata/entity-types.json';
import type { EntityClass } from '../types';

export class EntityTypeResolver {
  private types: Map<string, EntityClass>;

  constructor() {
    this.types = new Map();
    for (const type of entityTypes as EntityClass[]) {
      this.types.set(type.id, type);
    }
  }

  getType(typeId: string): EntityClass | undefined {
    return this.types.get(typeId);
  }

  async resolveEntityType(entityId: string): Promise<string | undefined> {
    try {
      const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=claims&format=json`;
      const response = await fetch(url);
      const data: {
        entities: Record<string, { claims: Record<string, { mainsnak: { datavalue?: { value: { id?: string } } } }[]> }>;
      } = await response.json();

      const entity = data.entities[entityId];
      if (!entity || !entity.claims || !entity.claims.P31) {
        return undefined;
      }

      const instanceOf = entity.claims.P31[0]?.mainsnak?.datavalue?.value?.id;
      return instanceOf;
    } catch {
      return undefined;
    }
  }
}
