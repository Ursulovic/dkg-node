import type { DKG } from "dkg.js";

interface SearchParams {
  query?: string;
  topic?: string;
  category?: string;
  minReliability?: number;
  maxReliability?: number;
  isPremium?: boolean;
  grokipediaUrl?: string;
  parentReport?: string;
  sortBy?: "reliability" | "createdAt" | "price";
  limit?: number;
  offset?: number;
}

interface NoteResult {
  ual: string;
  topic: string;
  category: string;
  reliability: number;
  isPremium: boolean;
  price?: {
    usdAmount: string;
    network: string;
  };
  summary: string;
  createdAt: string;
}

export class NoteSearchService {
  constructor(private dkg: DKG) {}

  async search(params: SearchParams): Promise<NoteResult[]> {
    const filters = this.buildFilters(params);
    const sparql = this.buildSparqlQuery(filters, params);

    const results = await this.dkg.graph.query(sparql);

    return results;
  }

  private buildFilters(params: SearchParams): string[] {
    const filters: string[] = [];

    if (params.topic) {
      filters.push(
        `CONTAINS(LCASE(?topic), "${params.topic.toLowerCase()}")`,
      );
    }

    if (params.category) {
      filters.push(`?category = "${params.category}"`);
    }

    if (params.minReliability !== undefined) {
      filters.push(`?reliability >= ${params.minReliability}`);
    }

    if (params.maxReliability !== undefined) {
      filters.push(`?reliability <= ${params.maxReliability}`);
    }

    if (params.isPremium !== undefined) {
      filters.push(`?isPremium = ${params.isPremium}`);
    }

    if (params.grokipediaUrl) {
      filters.push(`?grokipediaUrl = "${params.grokipediaUrl}"`);
    }

    if (params.parentReport) {
      filters.push(`?parentReport = "${params.parentReport}"`);
    }

    return filters;
  }

  private buildSparqlQuery(
    filters: string[],
    params: SearchParams,
  ): string {
    const filterClause =
      filters.length > 0 ? "FILTER(" + filters.join(" && ") + ")" : "";

    const sortBy = params.sortBy || "reliability";
    const orderClause =
      sortBy === "reliability"
        ? "DESC(?reliability)"
        : sortBy === "createdAt"
          ? "DESC(?createdAt)"
          : "?price";

    const limit = params.limit || 20;
    const offset = params.offset || 0;

    return `
      PREFIX schema: <https://schema.org/>
      PREFIX dkg: <http://dkg.origintrail.io/>

      SELECT ?ual ?topic ?category ?reliability ?isPremium ?price ?summary ?createdAt
      WHERE {
        ?asset a schema:BiasDetectionNote ;
               dkg:ual ?ual ;
               schema:topic ?topic ;
               schema:category ?category ;
               schema:reliability ?reliability ;
               schema:isPremium ?isPremium ;
               schema:summary ?summary ;
               schema:createdAt ?createdAt .

        OPTIONAL { ?asset schema:price ?price . }
        OPTIONAL { ?asset schema:grokipediaUrl ?grokipediaUrl . }
        OPTIONAL { ?asset schema:parentReport ?parentReport . }

        ${filterClause}
      }
      ORDER BY ${orderClause}
      LIMIT ${limit}
      OFFSET ${offset}
    `.trim();
  }

  async getNote(ual: string): Promise<any> {
    return this.dkg.asset.get(ual);
  }

  async getPrivateContent(ual: string): Promise<any> {
    return this.dkg.asset.get(ual, { contentType: "all" });
  }
}
