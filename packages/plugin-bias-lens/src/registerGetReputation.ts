import { type DkgPlugin } from "@dkg/plugins";
import { z } from "@dkg/plugin-swagger";
import { createPublicClient, http, formatUnits } from "viem";
import {
  neurowebTestnet,
  BIAS_LENS_REPUTATION_ADDRESS,
  BIAS_LENS_REPUTATION_ABI,
  REPUTATION_UI_URL,
} from "./reputation/config.js";

const title = "Get Knowledge Asset Reputation";
const name = "get-knowledge-asset-reputation";
const description = `Get the reputation/credibility score for a Knowledge Asset on the DKG.

**When to use:** User wants to know the community trust score for a Knowledge Asset.

**Input:**
- ual: Knowledge Asset UAL (e.g., did:dkg:otp:20430/0x.../12345) or DKG Explorer URL

**Output:** Returns:
- Credibility score (0-100%)
- Net score (positive = trusted, negative = disputed)
- Total TRAC staked
- Link to vote in the UI

**Note:** Reputation data comes from the BiasLensReputation smart contract on NeuroWeb Testnet.`;

const inputSchema = {
  ual: z.string().describe("Knowledge Asset UAL (e.g., did:dkg:otp:20430/0x.../12345) or DKG Explorer URL"),
};

function extractTokenIdFromUal(ual: string): bigint {
  const trimmed = ual.trim();

  // Handle plain number (legacy support)
  if (/^\d+$/.test(trimmed)) {
    return BigInt(trimmed);
  }

  // Handle DKG Explorer URL: https://dkg-testnet.origintrail.io/explore?ual=did:dkg:otp:20430/...
  if (trimmed.includes("dkg") && trimmed.includes("explore")) {
    const urlMatch = trimmed.match(/[?&]ual=([^&]+)/);
    if (urlMatch && urlMatch[1]) {
      const decodedUal = decodeURIComponent(urlMatch[1]);
      const tokenIdMatch = decodedUal.match(/\/(\d+)$/);
      if (tokenIdMatch && tokenIdMatch[1]) {
        return BigInt(tokenIdMatch[1]);
      }
    }
  }

  // Handle UAL format: did:dkg:otp:20430/0x.../12345
  const ualMatch = trimmed.match(/\/(\d+)$/);
  if (ualMatch && ualMatch[1]) {
    return BigInt(ualMatch[1]);
  }

  throw new Error(`Invalid UAL: ${ual}. Expected format: did:dkg:otp:20430/0x.../12345 or DKG Explorer URL`);
}

function normalizeUalChainId(ual: string, chainId: number): string {
  // Fix chain ID in UAL to match the network we're connected to
  // e.g., replace "otp:2043/" with "otp:20430/" for testnet
  return ual.replace(/otp:\d+\//, `otp:${chainId}/`);
}

export const registerGetReputation: DkgPlugin = (_, mcp) => {
  const client = createPublicClient({
    chain: neurowebTestnet,
    transport: http(),
  });

  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ ual }) => {
      try {
        const tokenId = extractTokenIdFromUal(ual);

        const [credibility, score, totalStaked, isRegistered, assetUal] = await Promise.all([
          client.readContract({
            address: BIAS_LENS_REPUTATION_ADDRESS,
            abi: BIAS_LENS_REPUTATION_ABI,
            functionName: "getCredibility",
            args: [tokenId],
          }),
          client.readContract({
            address: BIAS_LENS_REPUTATION_ADDRESS,
            abi: BIAS_LENS_REPUTATION_ABI,
            functionName: "getScore",
            args: [tokenId],
          }),
          client.readContract({
            address: BIAS_LENS_REPUTATION_ADDRESS,
            abi: BIAS_LENS_REPUTATION_ABI,
            functionName: "getTotalStaked",
            args: [tokenId],
          }),
          client.readContract({
            address: BIAS_LENS_REPUTATION_ADDRESS,
            abi: BIAS_LENS_REPUTATION_ABI,
            functionName: "isRegistered",
            args: [tokenId],
          }),
          client.readContract({
            address: BIAS_LENS_REPUTATION_ADDRESS,
            abi: BIAS_LENS_REPUTATION_ABI,
            functionName: "getUAL",
            args: [tokenId],
          }),
        ]);

        const scoreNum = Number(score);
        const totalStakedFormatted = formatUnits(totalStaked, 18);
        const credibilityColor = credibility >= 70n ? "HIGH" : credibility >= 40n ? "MEDIUM" : "LOW";

        const normalizedUal = normalizeUalChainId(assetUal, neurowebTestnet.id);
        const voteUrl = `${REPUTATION_UI_URL}?ual=${encodeURIComponent(normalizedUal)}`;
        const dkgExplorerUrl = `https://dkg-testnet.origintrail.io/explore?ual=${encodeURIComponent(normalizedUal)}`;

        if (!isRegistered) {
          return {
            content: [
              {
                type: "text",
                text: `**Knowledge Asset** - No votes yet

This Knowledge Asset hasn't received any reputation votes.

**UAL:** ${normalizedUal}
**DKG Explorer:** ${dkgExplorerUrl}

Be the first to vote: ${voteUrl}`,
              },
            ],
          };
        }

        const text = `**Knowledge Asset** - Reputation Score

**Credibility:** ${credibility}% (${credibilityColor})
**Net Score:** ${scoreNum >= 0 ? "+" : ""}${formatUnits(BigInt(scoreNum), 18)} TRAC
**Total Staked:** ${parseFloat(totalStakedFormatted).toFixed(2)} TRAC

**UAL:** ${normalizedUal}
**DKG Explorer:** ${dkgExplorerUrl}

**Vote on this Knowledge Asset:** ${voteUrl}`;

        return {
          content: [{ type: "text", text }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error getting reputation: ${message}`,
            },
          ],
        };
      }
    },
  );
};
