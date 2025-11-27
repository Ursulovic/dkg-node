import { type DkgPlugin } from "@dkg/plugins";
import { z } from "@dkg/plugin-swagger";
import { createPublicClient, http, formatUnits } from "viem";
import {
  neurowebTestnet,
  BIAS_LENS_REPUTATION_ADDRESS,
  BIAS_LENS_REPUTATION_ABI,
  REPUTATION_UI_URL,
} from "./reputation/config.js";

const title = "Get Report Reputation";
const name = "get-report-reputation";
const description = `Get the reputation/credibility score for a knowledge asset on the DKG.

**When to use:** User wants to know the community trust score for a bias report or knowledge asset.

**Input:**
- identifier: Either a UAL (did:dkg:otp:20430/...) or just the token ID number

**Output:** Returns:
- Credibility score (0-100%)
- Net score (positive = trusted, negative = disputed)
- Total TRAC staked
- Link to vote in the UI

**Note:** Reputation data comes from the BiasLensReputation smart contract on NeuroWeb Testnet.`;

const inputSchema = {
  identifier: z.string().describe("UAL (did:dkg:otp:20430/...) or token ID number"),
};

function extractTokenId(identifier: string): bigint {
  const trimmed = identifier.trim();

  if (/^\d+$/.test(trimmed)) {
    return BigInt(trimmed);
  }

  const ualMatch = trimmed.match(/\/(\d+)$/);
  if (ualMatch && ualMatch[1]) {
    return BigInt(ualMatch[1]);
  }

  throw new Error(`Invalid identifier: ${identifier}. Expected UAL or token ID.`);
}

export const registerGetReputation: DkgPlugin = (_, mcp) => {
  const client = createPublicClient({
    chain: neurowebTestnet,
    transport: http(),
  });

  mcp.registerTool(
    name,
    { title, description, inputSchema },
    async ({ identifier }) => {
      try {
        const tokenId = extractTokenId(identifier);

        const [credibility, score, totalStaked, isRegistered, ual] = await Promise.all([
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

        const voteUrl = `${REPUTATION_UI_URL}?tokenId=${tokenId}`;
        const dkgExplorerUrl = `https://dkg-testnet.origintrail.io/explore?ual=${encodeURIComponent(ual)}`;

        if (!isRegistered) {
          return {
            content: [
              {
                type: "text",
                text: `**Token #${tokenId}** - No votes yet

This knowledge asset hasn't received any reputation votes.

**UAL:** ${ual}
**DKG Explorer:** ${dkgExplorerUrl}

Be the first to vote: ${voteUrl}`,
              },
            ],
          };
        }

        const text = `**Token #${tokenId}** - Reputation Score

**Credibility:** ${credibility}% (${credibilityColor})
**Net Score:** ${scoreNum >= 0 ? "+" : ""}${formatUnits(BigInt(scoreNum), 18)} TRAC
**Total Staked:** ${parseFloat(totalStakedFormatted).toFixed(2)} TRAC

**UAL:** ${ual}
**DKG Explorer:** ${dkgExplorerUrl}

**Vote on this report:** ${voteUrl}`;

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
