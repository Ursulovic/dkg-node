import { type DkgPlugin } from "@dkg/plugins";
import { openAPIRoute, z } from "@dkg/plugin-swagger";
import { paymentMiddleware } from "x402-express";

import { NoteSearchService } from "./services/NoteSearchService";

const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:9200";
const PAYMENT_WALLET = (process.env.PAYMENT_WALLET_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;
const USDC_CONTRACT_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as `0x${string}`;
const DEFAULT_NOTE_PRICE = "$0.001";

export const registerPremiumAccess: DkgPlugin = (ctx, mcp, api) => {
  const searchService = new NoteSearchService(ctx.dkg);

  api.use(
    paymentMiddleware(PAYMENT_WALLET, {
      "GET /api/notes/:ual/private": {
        price: DEFAULT_NOTE_PRICE,
        network: "base-sepolia",
        description: "Access premium bias detection note content",
        tokenAddress: USDC_CONTRACT_BASE_SEPOLIA,
      },
      "POST /api/notes/batch-purchase": {
        price: DEFAULT_NOTE_PRICE,
        network: "base-sepolia",
        description: "Purchase multiple premium notes at once",
        tokenAddress: USDC_CONTRACT_BASE_SEPOLIA,
      },
    }, {
      url: "https://x402.org/facilitator",
    }),
  );

  api.get(
    "/api/notes/search",
    openAPIRoute(
      {
        tag: "Premium Notes",
        summary: "Search bias detection notes",
        description:
          "Search and filter bias detection notes by topic, category, reliability, and premium status",
        query: z.object({
          query: z
            .string()
            .optional()
            .describe("Search query for semantic matching"),
          topic: z.string().optional().describe("Topic keyword to filter by"),
          category: z
            .enum(["factualError", "missingContext", "sourceProblem"])
            .optional()
            .describe("Note category filter"),
          minReliability: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe("Minimum reliability score (0.0-1.0)"),
          maxReliability: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe("Maximum reliability score (0.0-1.0)"),
          isPremium: z
            .boolean()
            .optional()
            .describe("Filter by premium status"),
          grokipediaUrl: z
            .string()
            .optional()
            .describe("Filter by source Grokipedia URL"),
          parentReport: z
            .string()
            .optional()
            .describe("Filter by parent report UAL"),
          sortBy: z
            .enum(["reliability", "createdAt", "price"])
            .optional()
            .describe("Sort results by field"),
          limit: z.number().optional().describe("Maximum results to return"),
          offset: z.number().optional().describe("Pagination offset"),
        }),
        response: {
          description: "Search results",
          schema: z.object({
            notes: z.array(z.any()),
            total: z.number(),
            filters: z.any(),
          }),
        },
      },
      async (req, res) => {
        const params = {
          query: req.query.query as string | undefined,
          topic: req.query.topic as string | undefined,
          category: req.query.category as
            | "factualError"
            | "missingContext"
            | "sourceProblem"
            | undefined,
          minReliability: req.query.minReliability
            ? parseFloat(req.query.minReliability as string)
            : undefined,
          maxReliability: req.query.maxReliability
            ? parseFloat(req.query.maxReliability as string)
            : undefined,
          isPremium:
            req.query.isPremium === "true"
              ? true
              : req.query.isPremium === "false"
                ? false
                : undefined,
          grokipediaUrl: req.query.grokipediaUrl as string | undefined,
          parentReport: req.query.parentReport as string | undefined,
          sortBy: (req.query.sortBy as "reliability" | "createdAt" | "price") ||
            "reliability",
          limit: req.query.limit
            ? parseInt(req.query.limit as string)
            : 20,
          offset: req.query.offset
            ? parseInt(req.query.offset as string)
            : 0,
        };

        const notes = await searchService.search(params);

        res.json({
          notes,
          total: notes.length,
          filters: params,
        });
      },
    ),
  );

  api.get(
    "/api/notes/:ual",
    openAPIRoute(
      {
        tag: "Premium Notes",
        summary: "Get note preview",
        description:
          "Get public metadata for a specific note (no payment required)",
        params: z.object({
          ual: z.string().describe("Note UAL (did:dkg:otp:2043/...)"),
        }),
        response: {
          description: "Note preview",
          schema: z.object({
            ual: z.string(),
            isPremium: z.boolean(),
            metadata: z.any(),
          }),
        },
      },
      async (req, res) => {
        const { ual } = req.params;

        const asset = await searchService.getNote(ual);

        res.json({
          ual,
          isPremium: asset.public?.isPremium || false,
          metadata: asset.public || asset,
        });
      },
    ),
  );

  api.get(
    "/api/notes/:ual/private",
    openAPIRoute(
      {
        tag: "Premium Notes",
        summary: "Get private note content (PROTECTED)",
        description:
          "Access private note content. This endpoint will be protected by x402 payment in the future.",
        params: z.object({
          ual: z.string().describe("Note UAL"),
        }),
        response: {
          description: "Private note content",
          schema: z.object({
            ual: z.string(),
            content: z.any(),
          }),
        },
      },
      async (req, res) => {
        const { ual } = req.params;

        const fullAsset = await searchService.getPrivateContent(ual);

        if (!fullAsset.private) {
          return res.status(404).json({
            error: "No private content found for this note",
          });
        }

        res.json({
          ual,
          content: fullAsset.private,
        });
      },
    ),
  );

  api.post(
    "/api/notes/batch-purchase",
    openAPIRoute(
      {
        tag: "Premium Notes",
        summary: "Purchase multiple notes at once (PROTECTED)",
        description:
          "Purchase and access private content for multiple notes in a single transaction. Total price is calculated as sum of individual note prices. This endpoint will be protected by x402 payment in the future.",
        body: z.object({
          uals: z
            .array(z.string())
            .min(1)
            .describe("Array of note UALs to purchase"),
        }),
        response: {
          description: "Batch purchase result",
          schema: z.object({
            totalPrice: z.object({
              usdAmount: z.string(),
              network: z.string(),
            }),
            notes: z.array(
              z.object({
                ual: z.string(),
                content: z.any(),
                price: z.object({
                  usdAmount: z.string(),
                  network: z.string(),
                }),
              }),
            ),
          }),
        },
      },
      async (req, res) => {
        const { uals } = req.body;

        const results = await Promise.all(
          uals.map(async (ual) => {
            try {
              const preview = await searchService.getNote(ual);
              const fullAsset = await searchService.getPrivateContent(ual);

              if (!fullAsset.private) {
                return {
                  ual,
                  error: "No private content found",
                  price: null,
                  content: null,
                };
              }

              return {
                ual,
                content: fullAsset.private,
                price: preview.public?.price || {
                  usdAmount: "$0.50",
                  network: "base",
                },
                error: null,
              };
            } catch (error) {
              return {
                ual,
                error:
                  error instanceof Error ? error.message : "Unknown error",
                price: null,
                content: null,
              };
            }
          }),
        );

        const successfulNotes = results.filter((r) => !r.error);
        const failedNotes = results.filter((r) => r.error);

        if (successfulNotes.length === 0) {
          return res.status(404).json({
            error: "No valid notes found",
            failed: failedNotes,
          });
        }

        const totalPriceUSD = successfulNotes.reduce((sum, note) => {
          const priceStr = note.price?.usdAmount || "$0.50";
          const amount = parseFloat(priceStr.replace("$", ""));
          return sum + amount;
        }, 0);

        res.json({
          totalPrice: {
            usdAmount: `$${totalPriceUSD.toFixed(2)}`,
            network: successfulNotes[0].price?.network || "base",
          },
          notes: successfulNotes.map((note) => ({
            ual: note.ual,
            content: note.content,
            price: note.price,
          })),
          ...(failedNotes.length > 0 && {
            failed: failedNotes.map((note) => ({
              ual: note.ual,
              error: note.error,
            })),
          }),
        });
      },
    ),
  );

  mcp.registerTool(
    "search-premium-notes",
    {
      title: "Search premium bias detection notes",
      description:
        "Search and filter bias detection notes by topic, category, reliability. Use 'topic' for keyword matching.",
      inputSchema: {
        topic: z.string().optional().describe("Topic keyword to search for"),
        category: z
          .enum(["factualError", "missingContext", "sourceProblem"])
          .optional()
          .describe("Filter by note category"),
        minReliability: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Minimum reliability score"),
        isPremium: z
          .boolean()
          .optional()
          .describe("Filter by premium status (true for paid notes)"),
        limit: z
          .number()
          .optional()
          .default(10)
          .describe("Maximum number of results"),
      },
    },
    async (input) => {
      const params = new URLSearchParams();

      if (input.topic) params.append("topic", input.topic);
      if (input.category) params.append("category", input.category);
      if (input.minReliability !== undefined)
        params.append("minReliability", input.minReliability.toString());
      if (input.isPremium !== undefined)
        params.append("isPremium", input.isPremium.toString());
      if (input.limit !== undefined)
        params.append("limit", input.limit.toString());

      const response = await fetch(
        `${API_BASE_URL}/api/notes/search?${params}`,
      );
      const data = await response.json();

      const summary =
        data.notes
          .map(
            (note: any, i: number) =>
              `${i + 1}. ${note.topic} (${note.category}, reliability: ${note.reliability})\n` +
              `   ${note.isPremium ? `🔒 Premium (${note.price?.usdAmount || "paid"})` : "✅ Free"}\n` +
              `   UAL: ${note.ual}\n` +
              `   Summary: ${note.summary}`,
          )
          .join("\n\n") || "No notes found";

      return {
        content: [
          {
            type: "text",
            text: `Found ${data.total} notes:\n\n${summary}\n\nUse 'preview-note' tool to see more details or 'get-premium-note' to access premium content.`,
          },
        ],
      };
    },
  );

  mcp.registerTool(
    "preview-note",
    {
      title: "Preview a specific note",
      description:
        "Get public metadata for a note, including pricing if premium",
      inputSchema: {
        ual: z.string().describe("Note UAL (did:dkg:otp:2043/...)"),
      },
    },
    async ({ ual }) => {
      const response = await fetch(`${API_BASE_URL}/api/notes/${ual}`);
      const data = await response.json();

      if (data.isPremium) {
        return {
          content: [
            {
              type: "text",
              text: `Premium Note (${data.metadata.price?.usdAmount || "paid access"})\n\n` +
                `Topic: ${data.metadata.topic}\n` +
                `Category: ${data.metadata.category}\n` +
                `Reliability: ${data.metadata.reliability}\n` +
                `Summary: ${data.metadata.summary}\n\n` +
                `To access full content, use the 'get-premium-note' tool.`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: `Public Note (Free)\n\n${JSON.stringify(data.metadata, null, 2)}`,
            },
          ],
        };
      }
    },
  );

  mcp.registerTool(
    "get-premium-note",
    {
      title: "Get premium note content",
      description:
        "Access premium note content. In the future, this will require payment via MetaMask.",
      inputSchema: {
        ual: z.string().describe("Note UAL"),
      },
    },
    async ({ ual }) => {
      const response = await fetch(`${API_BASE_URL}/api/notes/${ual}/private`);

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error accessing premium note: ${response.statusText}`,
            },
          ],
        };
      }

      const data = await response.json();

      return {
        content: [
          { type: "text", text: "Premium content unlocked!" },
          {
            type: "text",
            text: JSON.stringify(data.content, null, 2),
          },
        ],
      };
    },
  );

  mcp.registerTool(
    "batch-purchase-notes",
    {
      title: "Purchase multiple premium notes at once",
      description:
        "Purchase and access private content for multiple notes in a single transaction. Provide note numbers (e.g., [3, 4, 5]) from search results, and the tool will calculate the total price and prompt for payment. This is more efficient than purchasing notes one-by-one.",
      inputSchema: {
        uals: z
          .array(z.string())
          .min(1)
          .describe("Array of note UALs to purchase"),
      },
    },
    async ({ uals }) => {
      const response = await fetch(`${API_BASE_URL}/api/notes/batch-purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uals }),
      });

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error processing batch purchase: ${response.statusText}`,
            },
          ],
        };
      }

      const data = await response.json();

      const summary = `Batch Purchase Complete!\n\nTotal Price: ${data.totalPrice.usdAmount} (${data.totalPrice.network})\nNotes Purchased: ${data.notes.length}\n\n`;

      const noteDetails = data.notes
        .map(
          (note: { ual: string; price: { usdAmount: string }; content: unknown }, i: number) =>
            `${i + 1}. ${note.ual}\n   Price: ${note.price.usdAmount}\n   Content: ${JSON.stringify(note.content, null, 2)}`,
        )
        .join("\n\n");

      const failedSection =
        data.failed && data.failed.length > 0
          ? `\n\nFailed Notes:\n${data.failed.map((f: { ual: string; error: string }) => `- ${f.ual}: ${f.error}`).join("\n")}`
          : "";

      return {
        content: [
          {
            type: "text",
            text: summary + noteDetails + failedSection,
          },
        ],
      };
    },
  );
};
