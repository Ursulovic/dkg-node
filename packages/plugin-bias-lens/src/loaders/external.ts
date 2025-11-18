import { WebPDFLoader } from "@langchain/community/document_loaders/web/pdf";
import { randomUUID } from "node:crypto";
import { Document } from "@langchain/core/documents";

interface ExternalMetadata {
  source: string;
  title?: string;
  fileType: "pdf";
}

type ExternalDocument = Document<ExternalMetadata> & { id: string };

export interface LoadPdfResult {
  success: ExternalDocument[];
  failed: Array<{ url: string; error: string; details?: string }>;
}

export class ExternalLoader {
  /**
   * Load a single PDF from URL
   * @param url - URL of the PDF to load
   * @returns Array of documents (one per page if splitPages is true)
   * @throws Error if PDF cannot be loaded
   */
  async loadPdf(url: string): Promise<ExternalDocument[]> {
    // 1. Fetch PDF as blob
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Failed to fetch PDF from ${url}: ${response.statusText}`,
      );
    }

    // 2. Verify content type
    const contentType = response.headers.get("content-type");
    if (contentType && !contentType.includes("pdf")) {
      throw new Error(
        `URL does not point to a PDF file. Content-Type: ${contentType}`,
      );
    }

    const blob = await response.blob();

    // 3. Load with LangChain WebPDFLoader
    const loader = new WebPDFLoader(blob, {
      splitPages: true, // Split into per-page documents for better retrieval
    });

    const documents = await loader.load();

    // 4. Map with UUID and typed metadata
    return documents.map((doc) => ({
      ...doc,
      id: randomUUID(),
      metadata: {
        source: url,
        title: (doc.metadata.pdf?.info?.Title as string) || undefined,
        fileType: "pdf" as const,
      },
    }));
  }

  /**
   * Load multiple PDFs in parallel batches
   * @param urls - Array of PDF URLs to load
   * @param batchSize - Number of PDFs to process in parallel (default: 5)
   * @returns Object with successful and failed PDF loads
   */
  async loadPdfs(
    urls: string[],
    batchSize = 5,
  ): Promise<LoadPdfResult> {
    const result: LoadPdfResult = {
      success: [],
      failed: [],
    };

    // Process URLs in batches
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);

      // Process batch in parallel
      const batchResults = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            const docs = await this.loadPdf(url);
            return { success: true as const, docs, url };
          } catch (error) {
            return {
              success: false as const,
              url,
              error:
                error instanceof Error ? error.message : "Unknown error",
            };
          }
        }),
      );

      // Collect results
      for (const batchResult of batchResults) {
        if (batchResult.status === "fulfilled") {
          const value = batchResult.value;
          if (value.success) {
            result.success.push(...value.docs);
          } else {
            result.failed.push({
              url: value.url,
              error: value.error,
            });
          }
        } else {
          // Promise was rejected (shouldn't happen with try/catch, but handle it)
          result.failed.push({
            url: "unknown",
            error: batchResult.reason?.message || "Promise rejected",
          });
        }
      }
    }

    return result;
  }
}
