import dotenv from "dotenv";
import { randomUUID } from "node:crypto";
import { Document } from "@langchain/core/documents";

dotenv.config();

export class WikipediaLoader {
  static baseUrl = "https://en.wikipedia.org";

  async query(q: string) {
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
    ] as Document<Record<string, any>>[];
  }
}
