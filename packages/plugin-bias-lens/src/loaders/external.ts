import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HumanMessage } from "@langchain/core/messages";
import { randomUUID } from "node:crypto";
import { writeFile, unlink, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { load as cheerioLoad } from "cheerio";
import TurndownService from "turndown";
import type { Link } from "../parsers/wikipedia.js";

export type {
  ExternalAssetDocument,
  ExternalAssetsLoaderCallbacks,
  ExternalAssetsLoaderOptions,
  HtmlDocument,
  LoadError,
  LoadResult,
  LoadStats,
  MediaDocument,
  PdfDocument,
} from "./types.js";

import type {
  ExternalAssetDocument,
  ExternalAssetsLoaderCallbacks,
  ExternalAssetsLoaderOptions,
  HtmlDocument,
  LoadError,
  LoadResult,
  LoadStats,
  MediaDocument,
  PdfDocument,
} from "./types.js";

export class ExternalAssetsLoader {
  private turndownService: TurndownService;
  private readonly timeout: number;
  private readonly concurrency: number;
  private callbacks?: ExternalAssetsLoaderCallbacks;

  constructor(options: ExternalAssetsLoaderOptions = {}) {
    this.timeout = options.timeout ?? 10000;
    this.concurrency = options.concurrency ?? 10;
    this.callbacks = options.callbacks;

    this.turndownService = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
    });

    this.turndownService.addRule("absolute-links", {
      filter: "a",
      replacement: (content, node) => {
        const href = (node as HTMLAnchorElement).getAttribute("href");
        if (!href) return content;
        const absoluteHref = href.startsWith("/")
          ? `https://en.wikipedia.org${href}`
          : href;
        return `[${content}](${absoluteHref})`;
      },
    });
  }

  private async fetchWithTimeout(
    url: string,
    options?: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private deduplicateLinks(links: Link[]): { unique: Link[]; duplicateCount: number } {
    const seen = new Set<string>();
    const unique: Link[] = [];

    for (const link of links) {
      if (!seen.has(link.url)) {
        seen.add(link.url);
        unique.push(link);
      }
    }

    return {
      unique,
      duplicateCount: links.length - unique.length,
    };
  }

  private async invokeCallback<T extends (...args: any[]) => void | Promise<void>>(
    callback: T | undefined,
    ...args: Parameters<T>
  ): Promise<void> {
    if (!callback) return;

    try {
      await callback(...args);
    } catch (error) {
      console.error("Callback error:", error);
    }
  }

  async loadPDFs(links: Link[], sourceUrl: string): Promise<LoadResult<PdfDocument>> {
    const errors: LoadError[] = [];
    const documents: PdfDocument[] = [];

    if (links.length === 0) {
      return {
        documents: [],
        errors: [],
        stats: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
      };
    }

    const { unique, duplicateCount } = this.deduplicateLinks(links);

    await this.invokeCallback(
      this.callbacks?.onPhaseStart,
      "pdf",
      unique.length,
      duplicateCount,
    );

    let tempDir: string | null = null;

    try {
      tempDir = await mkdtemp(join(tmpdir(), "bias-lens-pdfs-"));

      for (let i = 0; i < unique.length; i += this.concurrency) {
        const batch = unique.slice(i, i + this.concurrency);

        await Promise.all(
          batch.map(async (link, idx) => {
            try {
              const response = await this.fetchWithTimeout(link.url);

              if (!response.ok) {
                const error = `HTTP ${response.status}`;
                errors.push({ url: link.url, type: link.type, error });
                await this.invokeCallback(
                  this.callbacks?.onAssetError,
                  "pdf",
                  link.url,
                  error,
                  i + idx,
                  unique.length,
                );
                return;
              }

              const buffer = await response.arrayBuffer();
              const tempFilePath = join(tempDir!, `${randomUUID()}.pdf`);

              await writeFile(tempFilePath, Buffer.from(buffer));

              const loader = new PDFLoader(tempFilePath);
              const docs = await loader.load();

              for (const doc of docs) {
                documents.push({
                  ...doc,
                  id: randomUUID(),
                  metadata: {
                    source: sourceUrl,
                    assetSource: link.url,
                    assetType: "pdf",
                  },
                });
              }

              await unlink(tempFilePath);

              await this.invokeCallback(
                this.callbacks?.onAssetLoaded,
                "pdf",
                link.url,
                i + idx,
                unique.length,
              );
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              errors.push({ url: link.url, type: link.type, error: errorMessage });
              await this.invokeCallback(
                this.callbacks?.onAssetError,
                "pdf",
                link.url,
                errorMessage,
                i + idx,
                unique.length,
              );
            }
          }),
        );
      }
    } finally {
      if (tempDir) {
        try {
          await rm(tempDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    const stats: LoadStats = {
      total: links.length,
      succeeded: documents.length,
      failed: errors.length,
      skipped: duplicateCount,
    };

    await this.invokeCallback(this.callbacks?.onPhaseComplete, "pdf", stats);

    return { documents, errors, stats };
  }

  async loadHTML(links: Link[], sourceUrl: string): Promise<LoadResult<HtmlDocument>> {
    const errors: LoadError[] = [];
    const documents: HtmlDocument[] = [];

    if (links.length === 0) {
      return {
        documents: [],
        errors: [],
        stats: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
      };
    }

    const { unique, duplicateCount } = this.deduplicateLinks(links);

    await this.invokeCallback(
      this.callbacks?.onPhaseStart,
      "html",
      unique.length,
      duplicateCount,
    );

    for (let i = 0; i < unique.length; i += this.concurrency) {
      const batch = unique.slice(i, i + this.concurrency);

      await Promise.all(
        batch.map(async (link, idx) => {
          try {
            const response = await this.fetchWithTimeout(link.url);

            if (!response.ok) {
              const error = `HTTP ${response.status}`;
              errors.push({ url: link.url, type: link.type, error });
              await this.invokeCallback(
                this.callbacks?.onAssetError,
                "html",
                link.url,
                error,
                i + idx,
                unique.length,
              );
              return;
            }

            const html = await response.text();
            const $ = cheerioLoad(html);
            const body = $("body").html() || html;
            const markdown = this.turndownService.turndown(body);

            documents.push({
              pageContent: markdown,
              id: randomUUID(),
              metadata: {
                source: sourceUrl,
                assetSource: link.url,
                assetType: "html",
              },
            });

            await this.invokeCallback(
              this.callbacks?.onAssetLoaded,
              "html",
              link.url,
              i + idx,
              unique.length,
            );
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            errors.push({ url: link.url, type: link.type, error: errorMessage });
            await this.invokeCallback(
              this.callbacks?.onAssetError,
              "html",
              link.url,
              errorMessage,
              i + idx,
              unique.length,
            );
          }
        }),
      );
    }

    const stats: LoadStats = {
      total: links.length,
      succeeded: documents.length,
      failed: errors.length,
      skipped: duplicateCount,
    };

    await this.invokeCallback(this.callbacks?.onPhaseComplete, "html", stats);

    return { documents, errors, stats };
  }

  async loadMedia(links: Link[], sourceUrl: string): Promise<LoadResult<MediaDocument>> {
    const errors: LoadError[] = [];
    const documents: MediaDocument[] = [];

    if (links.length === 0) {
      return {
        documents: [],
        errors: [],
        stats: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
      };
    }

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      throw new Error("GOOGLE_API_KEY environment variable is required for media loading");
    }

    const { unique, duplicateCount } = this.deduplicateLinks(links);

    await this.invokeCallback(
      this.callbacks?.onPhaseStart,
      "media",
      unique.length,
      duplicateCount,
    );

    const model = new ChatGoogleGenerativeAI({
      apiKey,
      model: "gemini-1.5-flash",
    });

    for (const [idx, link] of unique.entries()) {

      try {
        const response = await this.fetchWithTimeout(link.url);

        if (!response.ok) {
          const error = `HTTP ${response.status}`;
          errors.push({ url: link.url, type: link.type, error });
          await this.invokeCallback(
            this.callbacks?.onAssetError,
            "media",
            link.url,
            error,
            idx,
            unique.length,
          );
          continue;
        }

        const buffer = await response.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString("base64");

        const urlLower = link.url.toLowerCase();
        let mimeType: string;
        const contentTypeHeader = response.headers.get("content-type");

        if (link.type === "image") {
          if (urlLower.includes(".png")) mimeType = "image/png";
          else if (urlLower.includes(".jpg") || urlLower.includes(".jpeg"))
            mimeType = "image/jpeg";
          else if (urlLower.includes(".gif")) mimeType = "image/gif";
          else if (urlLower.includes(".webp")) mimeType = "image/webp";
          else mimeType = contentTypeHeader || "image/jpeg";
        } else if (link.type === "video") {
          mimeType = contentTypeHeader || "video/mp4";
        } else {
          mimeType = contentTypeHeader || "audio/mpeg";
        }

        let message: HumanMessage;
        const promptText =
          link.type === "image"
            ? "Describe this image in detail."
            : link.type === "video"
              ? "Describe what happens in this video."
              : "Transcribe or describe this audio.";

        if (link.type === "image") {
          message = new HumanMessage({
            content: [
              { type: "text", text: promptText },
              {
                type: "image_url",
                image_url: `data:${mimeType};base64,${base64Data}`,
              },
            ],
          });
        } else {
          message = new HumanMessage({
            content: [
              { type: "text", text: promptText },
              {
                type: "media",
                data: base64Data,
                mime_type: mimeType,
              } as any,
            ],
          });
        }

        const geminiResponse = await model.invoke([message]);
        const description =
          typeof geminiResponse.content === "string"
            ? geminiResponse.content
            : JSON.stringify(geminiResponse.content);

        documents.push({
          pageContent: description,
          id: randomUUID(),
          metadata: {
            source: sourceUrl,
            assetSource: link.url,
            assetType: link.type as "image" | "video" | "audio",
          },
        });

        await this.invokeCallback(
          this.callbacks?.onAssetLoaded,
          "media",
          link.url,
          idx,
          unique.length,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ url: link.url, type: link.type, error: errorMessage });
        await this.invokeCallback(
          this.callbacks?.onAssetError,
          "media",
          link.url,
          errorMessage,
          idx,
          unique.length,
        );
      }
    }

    const stats: LoadStats = {
      total: links.length,
      succeeded: documents.length,
      failed: errors.length,
      skipped: duplicateCount,
    };

    await this.invokeCallback(this.callbacks?.onPhaseComplete, "media", stats);

    return { documents, errors, stats };
  }

  async loadLinks(
    links: Link[],
    sourceUrl: string,
  ): Promise<LoadResult<ExternalAssetDocument>> {
    const pdfLinks = links.filter((link) => link.type === "pdf");
    const htmlLinks = links.filter((link) => link.type === "html");
    const mediaLinks = links.filter((link) =>
      ["image", "video", "audio"].includes(link.type),
    );

    const pdfResult =
      pdfLinks.length > 0
        ? await this.loadPDFs(pdfLinks, sourceUrl)
        : {
            documents: [],
            errors: [],
            stats: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
          };

    const htmlResult =
      htmlLinks.length > 0
        ? await this.loadHTML(htmlLinks, sourceUrl)
        : {
            documents: [],
            errors: [],
            stats: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
          };

    const mediaResult =
      mediaLinks.length > 0
        ? await this.loadMedia(mediaLinks, sourceUrl)
        : {
            documents: [],
            errors: [],
            stats: { total: 0, succeeded: 0, failed: 0, skipped: 0 },
          };

    const documents: ExternalAssetDocument[] = [
      ...pdfResult.documents,
      ...htmlResult.documents,
      ...mediaResult.documents,
    ];

    const errors: LoadError[] = [
      ...pdfResult.errors,
      ...htmlResult.errors,
      ...mediaResult.errors,
    ];

    const stats: LoadStats = {
      total: pdfResult.stats.total + htmlResult.stats.total + mediaResult.stats.total,
      succeeded:
        pdfResult.stats.succeeded +
        htmlResult.stats.succeeded +
        mediaResult.stats.succeeded,
      failed:
        pdfResult.stats.failed + htmlResult.stats.failed + mediaResult.stats.failed,
      skipped:
        pdfResult.stats.skipped +
        htmlResult.stats.skipped +
        mediaResult.stats.skipped,
    };

    await this.invokeCallback(this.callbacks?.onLoadComplete, stats);

    return { documents, errors, stats };
  }
}
