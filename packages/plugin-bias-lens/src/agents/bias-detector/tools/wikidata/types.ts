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
  query: string;
}

export interface WikidataQueryResult {
  success: boolean;
  response: string;
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
  "xml:lang"?: string;
}

export interface SparqlResult {
  head: {
    vars: string[];
  };
  results: {
    bindings: Record<string, SparqlBinding>[];
  };
}
