import { type DkgPlugin } from "@dkg/plugins";
import { z } from "@dkg/plugin-swagger";

import { createX402FetchClient } from "./x402/client.js";

const title = "Get Paid Bias Report (x402)";
const name = "get-paid-bias-report";
const description = `Fetches a bias report from another DKG node using x402 payment protocol.

**When to use:** Agent needs to access a full bias report (including private findings) from a remote node that requires payment.

**Input:**
- nodeUrl: Base URL of the DKG node (e.g., "https://example-node.com")
- ual: UAL of the bias report to fetch

**Payment Flow:**
1. Makes initial request to get pricing info
2. If payment required, automatically signs and sends USDC payment
3. Returns full report (public + private sections)

**Requirements:**
- X402_CLIENT_PRIVATE_KEY environment variable must be set
- Wallet must have sufficient USDC on Base Sepolia

**Output:** Complete bias report with public summary and private detailed findings.`;

const inputSchema = {
  nodeUrl: z.string().describe("Base URL of the DKG node"),
  ual: z.string().describe("UAL of the bias report to fetch"),
};

interface X402PricingInfo {
  paymentRequired: boolean;
  price: number;
  priceCurrency: string;
  network: string;
  description: string;
}

interface X402ReportResponse {
  public: Record<string, unknown>;
  private?: Record<string, unknown>;
  _x402?: X402PricingInfo;
}

export const registerX402Client: DkgPlugin = (_, mcp) => {
  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ nodeUrl, ual }) => {
      const endpoint = `${nodeUrl}/x402/report/${encodeURIComponent(ual)}`;

      const previewResponse = await fetch(endpoint);

      if (!previewResponse.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Failed to fetch report preview (${previewResponse.status})\n\nPlease verify the node URL and UAL are correct.`,
            },
          ],
        };
      }

      const preview = (await previewResponse.json()) as X402ReportResponse;

      if (!preview._x402?.paymentRequired) {
        return {
          content: [
            {
              type: "text",
              text: "Report retrieved (no payment required):\n\n" +
                JSON.stringify(preview, null, 2),
            },
          ],
        };
      }

      let fetchWithPay: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
      try {
        fetchWithPay = await createX402FetchClient();
      } catch {
        const pricingInfo = preview._x402;
        return {
          content: [
            {
              type: "text",
              text: `Payment required but wallet not configured.\n\n` +
                `Price: ${pricingInfo.price} ${pricingInfo.priceCurrency}\n` +
                `Network: ${pricingInfo.network}\n\n` +
                `To enable payments, set X402_CLIENT_PRIVATE_KEY environment variable.\n\n` +
                `Public preview:\n${JSON.stringify(preview.public, null, 2)}`,
            },
          ],
        };
      }

      const paidResponse = await fetchWithPay(endpoint);

      if (!paidResponse.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Error: Payment failed or was rejected (${paidResponse.status})\n\n` +
                `Please ensure your wallet has sufficient USDC on Base Sepolia.`,
            },
          ],
        };
      }

      const fullReport = (await paidResponse.json()) as X402ReportResponse;

      const summary = extractReportSummary(fullReport);

      return {
        content: [
          {
            type: "text",
            text: `Payment successful! Full report retrieved.\n\n${summary}`,
          },
          {
            type: "text",
            text: JSON.stringify(fullReport, null, 2),
          },
        ],
      };
    }
  );
};

function extractReportSummary(report: X402ReportResponse): string {
  const pub = report.public as Record<string, unknown>;
  const priv = report.private as Record<string, unknown> | undefined;

  const lines: string[] = [];

  if (pub.name) {
    lines.push(`**${pub.name}**`);
  }

  if (pub.description) {
    lines.push(`${pub.description}`);
  }

  if (pub.reviewRating) {
    const rating = pub.reviewRating as Record<string, unknown>;
    lines.push(`Bias Level: ${rating.ratingValue}/5`);
  }

  if (priv) {
    const claims = priv.claims as Array<unknown> | undefined;
    if (claims?.length) {
      lines.push(`Private findings: ${claims.length} detailed claims with evidence`);
    }
  }

  return lines.join("\n");
}
