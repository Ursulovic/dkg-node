export interface OntologyClass {
  uri: string;
  label: string;
  description?: string;
  parentClass?: string;
  namespace: string;
}

export interface OntologyProperty {
  uri: string;
  label: string;
  description?: string;
  domain: string[];
  range: string[];
  namespace: string;
}

export interface ClassWithProperties {
  cls: OntologyClass;
  hierarchy: string[];
  directProperties: OntologyProperty[];
  inheritedProperties: Map<string, OntologyProperty[]>;
}

export interface ClassDocumentMetadata {
  uri: string;
  label: string;
  description?: string;
  namespace: string;
  type: "class";
  hierarchy?: string[];
  fetchedAt: string;
}

export interface PropertyDocumentMetadata {
  uri: string;
  label: string;
  description?: string;
  namespace: string;
  type: "property";
  domain: string[];
  range: string[];
  fetchedAt: string;
}

export interface QueryExampleMetadata {
  id: string;
  category: string;
  priority: number;
  keywords: string[];
  type: "query-example";
  filePath: string;
}

export type DocumentMetadata = ClassDocumentMetadata | PropertyDocumentMetadata | QueryExampleMetadata;

export interface SerializedDocument {
  pageContent: string;
  metadata: DocumentMetadata;
}
