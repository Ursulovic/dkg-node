import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { randomUUID } from "node:crypto";

export class GrokipediaLoader {
  async loadPage(url: string) {
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
