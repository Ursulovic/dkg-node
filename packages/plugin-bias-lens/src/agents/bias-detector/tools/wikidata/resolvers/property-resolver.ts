import Fuse from 'fuse.js';
import wikidataProperties from '../../../../../data/wikidata/properties.json';
import type { WikidataProperty } from '../types';

export class PropertyResolver {
  private fuse: Fuse<WikidataProperty>;
  private cache: Map<string, WikidataProperty>;

  constructor() {
    this.fuse = new Fuse(wikidataProperties as WikidataProperty[], {
      keys: [
        { name: 'label', weight: 2 },
        { name: 'aliases', weight: 1.5 },
        { name: 'description', weight: 0.5 },
      ],
      threshold: 0.4,
      includeScore: true,
      minMatchCharLength: 3,
    });
    this.cache = new Map();
  }

  findProperty(searchTerm: string): WikidataProperty | null {
    const results = this.fuse.search(searchTerm);

    if (results.length > 0) {
      const firstResult = results[0];
      if (firstResult && firstResult.score !== undefined && firstResult.score < 0.4) {
        return firstResult.item;
      }
    }

    return null;
  }

  async findPropertyWithFallback(searchTerm: string): Promise<WikidataProperty | null> {
    const local = this.findProperty(searchTerm);
    if (local) return local;

    console.warn(`Property "${searchTerm}" not found locally, searching Wikidata API...`);
    return await this.searchWikidataAPI(searchTerm);
  }

  private async searchWikidataAPI(term: string): Promise<WikidataProperty | null> {
    const params = new URLSearchParams({
      action: 'wbsearchentities',
      format: 'json',
      language: 'en',
      type: 'property',
      search: term,
      limit: '1',
    });

    const response = await fetch(`https://www.wikidata.org/w/api.php?${params}`);
    const data: { search?: { id: string; label: string; description?: string }[] } =
      await response.json();

    if (data.search && data.search[0]) {
      const prop = {
        id: data.search[0].id,
        label: data.search[0].label,
        description: data.search[0].description,
        aliases: [],
        datatype: 'unknown',
      };
      this.cache.set(term, prop);
      return prop;
    }

    return null;
  }
}
