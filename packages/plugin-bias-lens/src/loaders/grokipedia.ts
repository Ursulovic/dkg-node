import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { randomUUID } from "node:crypto";
import { Document } from "@langchain/core/documents";

interface GrokipediaMetadata {
  source: string;
  title: string;
}

type GrokipediaDocument = Document<GrokipediaMetadata> & { id: string };

export class GrokipediaLoader {
  async loadPage(url: string): Promise<GrokipediaDocument[]> {
    if (!this.isValidUrl(url)) {
      throw new Error(`Invalid Grokipedia URL: ${url}`);
    }

    const loader = new CheerioWebBaseLoader(url, {
      selector: "body > article",
    });

    const documents = await loader.load();

    return documents.map((doc) => ({
      ...doc,
      id: randomUUID(),
      metadata: {
        source: doc.metadata.source || url,
        title: doc.metadata.title || "",
      },
    }));
  }

  private isValidUrl(value: string) {
    try {
      const url = new URL(value);

      if (url.host !== "grokipedia.com") {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }
}
