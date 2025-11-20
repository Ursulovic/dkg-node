import { FaissStore } from '@langchain/community/vectorstores/faiss';
import { OpenAIEmbeddings } from '@langchain/openai';
import { Document } from '@langchain/core/documents';
import { join } from 'node:path';

export class WikidataVectorStore {
  private store!: FaissStore;
  private embeddings: OpenAIEmbeddings;

  constructor() {
    this.embeddings = new OpenAIEmbeddings({
      modelName: 'text-embedding-3-small',
    });
  }

  async load(indexPath?: string): Promise<void> {
    const path = indexPath || join(process.cwd(), 'src/agents/bias-detector/tools/wikidata/wikidata-index');
    this.store = await FaissStore.load(path, this.embeddings);
  }

  async search(query: string, k: number = 10): Promise<Document[]> {
    if (!this.store) {
      throw new Error('Vector store not loaded. Call load() first.');
    }
    return this.store.similaritySearch(query, k);
  }

  async searchByType(query: string, type: string, k: number = 5): Promise<Document[]> {
    if (!this.store) {
      throw new Error('Vector store not loaded. Call load() first.');
    }

    const results = await this.store.similaritySearch(query, k * 3);

    const filtered = results.filter((doc) => doc.metadata.type === type);

    return filtered.slice(0, k);
  }

  async searchWithScores(query: string, k: number = 10): Promise<[Document, number][]> {
    if (!this.store) {
      throw new Error('Vector store not loaded. Call load() first.');
    }
    return this.store.similaritySearchWithScore(query, k);
  }
}
