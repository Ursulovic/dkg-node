export interface QueryExampleMetadata {
  id: string;
  category: string;
  priority: number;
  keywords: string[];
  type: "query-example";
  filePath: string;
}

export interface SerializedQueryDocument {
  pageContent: string;
  metadata: QueryExampleMetadata;
}
