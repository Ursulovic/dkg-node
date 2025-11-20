export interface WikidataProperty {
  id: string;
  label: string;
  description?: string;
  aliases: string[];
  datatype: string;
}

export interface PropertyConstraint {
  propertyId: string;
  constraintType: string;
  constraintTypeLabel: string;
  subjectTypes?: string[];
  valueTypes?: string[];
  formatPattern?: string;
}

export interface EntityClass {
  id: string;
  label: string;
  description?: string;
  instanceCount: number;
}

export interface WikidataQueryInput {
  entity: string;
  property: string;
}

export interface WikidataQueryResult {
  success: boolean;
  data?: {
    property: string;
    value: string | number;
    qualifiers?: Record<string, unknown>;
    wikidataEntityId: string;
    wikidataUrl: string;
    references?: string[];
  };
  error?: string;
}

export interface EntityResolution {
  entityId: string;
  label: string;
  description?: string;
}

export interface SparqlBinding {
  type: string;
  value: string;
  datatype?: string;
  'xml:lang'?: string;
}

export interface SparqlResult {
  head: {
    vars: string[];
  };
  results: {
    bindings: Record<string, SparqlBinding>[];
  };
}
