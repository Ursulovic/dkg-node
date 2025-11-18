import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { Document } from "@langchain/core/documents";

dotenv.config();

export interface WikipediaMetadata {
  source: string;
}

export type WikipediaDocument = Document<WikipediaMetadata> & { id: string };

export class WikipediaLoader {
  static baseUrl = "https://en.wikipedia.org";

  async query(q: string, shallow?: boolean): Promise<WikipediaDocument[]> {
    const url = new URL(`${WikipediaLoader.baseUrl}/w/index.php?search=${q}`);

    const response = await fetch(`https://r.jina.ai/${url.toString()}`, {
      headers: {
        Authorization: `Bearer ${process.env.JINA_AI_API_KEY}`,
      },
    });
    const result = await response.text();

    const pageContent = shallow ? result.slice(0, 3000) : result;

    return [
      {
        id: randomUUID(),
        metadata: {
          source: url.toString(),
        },
        pageContent: pageContent,
      },
    ];
  }

  async loadPage(url: string): Promise<WikipediaDocument[]> {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        Authorization: `Bearer ${process.env.JINA_AI_API_KEY}`,
      },
    });
    const result = await response.text();

    return [
      {
        id: randomUUID(),
        metadata: {
          source: url,
        },
        pageContent: result,
      },
    ];
  }
}
