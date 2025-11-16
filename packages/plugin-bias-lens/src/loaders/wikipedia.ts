import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { Document } from "@langchain/core/documents";

dotenv.config();

interface WikipediaMetadata {
  source: string;
}

type WikipediaDocument = Document<WikipediaMetadata> & { id: string };

export class WikipediaLoader {
  static baseUrl = "https://en.wikipedia.org";

  async query(q: string): Promise<WikipediaDocument[]> {
    const url = new URL(`${WikipediaLoader.baseUrl}/w/index.php?search=${q}`);

    const response = await fetch(`https://r.jina.ai/${url.toString()}`, {
      headers: {
        Authorization: `Bearer ${process.env.JINA_AI_API_KEY}`,
      },
    });
    const result = await response.text();

    return [
      {
        id: randomUUID(),
        metadata: {
          source: url.toString(),
        },
        pageContent: result,
      },
    ];
  }
}
