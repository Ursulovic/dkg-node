import { SinonStub } from "sinon";

/**
 * Mock responses for different URL patterns
 */
export const MOCK_RESPONSES = {
  // Valid HTML content
  validHTML: `
    <!DOCTYPE html>
    <html>
      <body>
        <h1>Test Article</h1>
        <p>This is a test article with some content about climate change and global warming.</p>
        <p>It contains multiple paragraphs for testing purposes.</p>
      </body>
    </html>
  `,

  // Valid PDF content (minimal PDF structure)
  validPDF: Buffer.from(
    "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n" +
      "4 0 obj\n<< /Length 44 >>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test PDF Content) Tj\nET\nendstream\nendobj\n" +
      "xref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n" +
      "0000000115 00000 n\n0000000214 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n317\n%%EOF",
  ),

  // Gemini API responses for media
  imageDescription:
    "This image shows a graph depicting global warming potential of various greenhouse gases over a 100-year timescale. The chart displays carbon dioxide as the baseline, with methane, nitrous oxide, and various fluorinated gases showing significantly higher warming potential values.",

  videoDescription:
    "This video discusses climate change mitigation strategies, featuring interviews with climate scientists and policymakers. Key topics include renewable energy transitions, carbon pricing mechanisms, and international cooperation on emissions reductions.",

  audioDescription:
    "This audio recording is a podcast episode about climate science. The host interviews a researcher discussing the latest findings on greenhouse gas emissions and their long-term impacts on global temperatures.",
};

/**
 * Setup fetch mock with predefined responses for common test URLs
 */
export function setupFetchMock(fetchStub: SinonStub): void {
  fetchStub.callsFake(async (url: string, options?: RequestInit) => {
    const urlStr = typeof url === "string" ? url : url.toString();

    // Handle broken/404 URLs
    if (urlStr.includes("does-not-exist") || urlStr.includes("broken-link")) {
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: async () => "404 Not Found",
        arrayBuffer: async () => new ArrayBuffer(0),
        headers: {
          get: () => null,
        },
      };
    }

    // Handle PDF URLs
    if (urlStr.endsWith(".pdf") || urlStr.includes("/pdf/")) {
      // Check if it's a HEAD request
      if (options?.method === "HEAD") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: {
            get: (name: string) =>
              name === "content-type" ? "application/pdf" : null,
          },
        };
      }

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (name: string) =>
            name === "content-type" ? "application/pdf" : null,
        },
        arrayBuffer: async () => MOCK_RESPONSES.validPDF.buffer,
      };
    }

    // Handle image URLs
    if (
      urlStr.match(/\.(jpg|jpeg|png|gif|svg|webp|bmp|ico)($|\?)/i) ||
      urlStr.includes("wikimedia.org") ||
      urlStr.includes("upload.wikimedia")
    ) {
      // Create a small mock image buffer (1x1 pixel PNG)
      const mockImage = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (name: string) =>
            name === "content-type" ? "image/png" : null,
        },
        arrayBuffer: async () => mockImage.buffer,
      };
    }

    // Handle video URLs
    if (urlStr.match(/\.(mp4|webm|ogg|mov)($|\?)/i)) {
      // Create a tiny mock video buffer
      const mockVideo = Buffer.from("MOCK_VIDEO_DATA");

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (name: string) => (name === "content-type" ? "video/mp4" : null),
        },
        arrayBuffer: async () => mockVideo.buffer,
      };
    }

    // Handle audio URLs
    if (urlStr.match(/\.(mp3|wav|ogg|m4a)($|\?)/i)) {
      // Create a tiny mock audio buffer
      const mockAudio = Buffer.from("MOCK_AUDIO_DATA");

      return {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (name: string) =>
            name === "content-type" ? "audio/mpeg" : null,
        },
        arrayBuffer: async () => mockAudio.buffer,
      };
    }

    // Handle HTML URLs (default)
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: {
        get: (name: string) => (name === "content-type" ? "text/html" : null),
      },
      text: async () => MOCK_RESPONSES.validHTML,
    };
  });
}

/**
 * Setup Gemini API mock for media interpretation
 */
export function setupGeminiMock(invokeStub: SinonStub): void {
  invokeStub.callsFake(async (messages: unknown[]) => {
    const message = Array.isArray(messages) ? messages[0] : messages;

    // Extract content type from message
    if (
      message &&
      typeof message === "object" &&
      "content" in message &&
      Array.isArray(message.content)
    ) {
      const content = message.content;

      // Check for image_url type
      if (content.some((c: unknown) => typeof c === "object" && c && "image_url" in c)) {
        return {
          content: MOCK_RESPONSES.imageDescription,
        };
      }

      // Check for video/audio media type
      const textContent = content.find(
        (c: unknown) => typeof c === "object" && c && "type" in c && c.type === "text",
      ) as { text?: string } | undefined;

      if (textContent?.text?.includes("video")) {
        return {
          content: MOCK_RESPONSES.videoDescription,
        };
      }

      if (textContent?.text?.includes("audio")) {
        return {
          content: MOCK_RESPONSES.audioDescription,
        };
      }
    }

    // Default response
    return {
      content: MOCK_RESPONSES.imageDescription,
    };
  });
}

/**
 * Create a mock fetch that simulates slow responses
 */
export function createSlowFetchMock(
  fetchStub: SinonStub,
  delayMs: number = 5000,
): void {
  fetchStub.callsFake(async (url: string) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    return {
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => MOCK_RESPONSES.validHTML,
      arrayBuffer: async () => MOCK_RESPONSES.validPDF.buffer,
    };
  });
}

/**
 * Create a mock fetch that simulates timeout/abort
 */
export function createTimeoutFetchMock(fetchStub: SinonStub): void {
  fetchStub.callsFake(async (_url: string, options?: RequestInit) => {
    // Simulate a long-running request that respects AbortSignal
    return new Promise((_, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Request timeout"));
      }, 30000); // 30 second default timeout

      // If AbortSignal is provided, respect it
      if (options?.signal) {
        options.signal.addEventListener("abort", () => {
          clearTimeout(timeout);
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      }
    });
  });
}

/**
 * Helper to count mock call patterns
 */
export function countMockCalls(
  stub: SinonStub,
  urlPattern: string | RegExp,
): number {
  return stub
    .getCalls()
    .filter((call) => {
      const url = call.args[0];
      const urlStr = typeof url === "string" ? url : url?.toString() || "";

      if (typeof urlPattern === "string") {
        return urlStr.includes(urlPattern);
      }
      return urlPattern.test(urlStr);
    }).length;
}

/**
 * Helper to get all unique URLs called
 */
export function getCalledUrls(stub: SinonStub): string[] {
  return stub.getCalls().map((call) => {
    const url = call.args[0];
    return typeof url === "string" ? url : url?.toString() || "";
  });
}
