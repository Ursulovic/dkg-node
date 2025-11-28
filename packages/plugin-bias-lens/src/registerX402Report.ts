import type { Request, Response, NextFunction } from "express";
import { type DkgPlugin } from "@dkg/plugins";
import { openAPIRoute, z } from "@dkg/plugin-swagger";
import { paymentMiddleware } from "x402-express";

import { reportStore } from "./store/index.js";
import { x402Config } from "./x402/config.js";

const title = "Get Paid Report (x402)";
const description = `Fetch a bias report by UAL. Returns public part for free, full report requires x402 payment.

**Behavior:**
- Without X-PAYMENT header: Returns public summary (free)
- With valid X-PAYMENT: Returns full report (public + private)
- With invalid payment: Returns 402 Payment Required

**Price:** Dynamic based on analysis cost (costUsd × 2.0), paid in USDC on Base Sepolia`;

export const registerX402Report: DkgPlugin = (_, __, api) => {
  const walletAddress = x402Config.serverWalletAddress;

  if (!walletAddress) {
    console.warn(
      "PUBLISHER_WALLET_ADDRESS not set - x402 endpoints will not work"
    );
    return;
  }

  const x402Middleware = paymentMiddleware(
    walletAddress as `0x${string}`,
    {
      "GET /*": {
        price: "$0.01",
        network: x402Config.network,
        config: {
          description: "Access to full bias report with detailed findings",
        },
      },
    },
    { url: x402Config.facilitatorUrl as `${string}://${string}` }
  );

  api.get(
    "/x402/report/:ual",
    (req: Request, res: Response, next: NextFunction) => {
      if (req.headers["x-payment"]) {
        return x402Middleware(req, res, next);
      }
      next();
    },
    openAPIRoute(
      {
        tag: title,
        summary: description,
        params: z.object({
          ual: z.string().describe("URL-encoded UAL of the report"),
        }),
        response: {
          description: "Bias report (public only or full depending on payment)",
          schema: z.object({
            public: z.any(),
            private: z.any().optional(),
            _x402: z
              .object({
                paymentRequired: z.boolean(),
                price: z.number(),
                priceCurrency: z.string(),
                network: z.string(),
                description: z.string(),
              })
              .optional(),
          }),
        },
      },
      async (req, res) => {
        const ual = decodeURIComponent(req.params.ual);

        const allReports = await reportStore.list();
        const reportEntry = allReports.find((r) => r.metadata.ual === ual);

        if (!reportEntry) {
          return res.status(404).json({ error: "Report not found" });
        }

        const report = await reportStore.get(reportEntry.id);
        if (!report) {
          return res.status(404).json({ error: "Report not found" });
        }

        const priceUsdc =
          report.knowledgeAsset.public.offers?.price ??
          report.metadata.costUsd * 2.0;
        const hasPaymentHeader = !!req.headers["x-payment"];

        if (!hasPaymentHeader) {
          return res.json({
            public: report.knowledgeAsset.public,
            _x402: {
              paymentRequired: true,
              price: priceUsdc,
              priceCurrency: "USDC",
              network: x402Config.network,
              description: "Pay to access detailed findings with evidence",
            },
          });
        }

        return res.json({
          public: report.knowledgeAsset.public,
          private: report.knowledgeAsset.private,
        });
      }
    )
  );
};
