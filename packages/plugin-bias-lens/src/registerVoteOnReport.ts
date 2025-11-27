import { type DkgPlugin } from "@dkg/plugins";
import { z } from "@dkg/plugin-swagger";
import {
  createPublicClient,
  createWalletClient,
  http,
  formatUnits,
  parseUnits,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  neurowebTestnet,
  BIAS_LENS_REPUTATION_ADDRESS,
  BIAS_LENS_REPUTATION_ABI,
  TRAC_TOKEN_ADDRESS,
  ERC20_ABI,
  REPUTATION_UI_URL,
} from "./reputation/config.js";

const upvoteTitle = "Upvote Bias Report";
const upvoteName = "upvote-bias-report";
const upvoteDescription = `Upvote a bias report on the DKG by staking TRAC tokens.

**When to use:** User wants to support/validate a bias report's credibility.

**Input:**
- identifier: Either a UAL (did:dkg:otp:20430/...) or just the token ID number
- amount: Amount of TRAC to stake (e.g., "1.0" for 1 TRAC)

**Output:** Transaction confirmation with updated reputation score.

**Note:** Uses the node's configured wallet (DKG_PUBLISH_WALLET). Requires TRAC tokens.`;

const downvoteTitle = "Downvote Bias Report";
const downvoteName = "downvote-bias-report";
const downvoteDescription = `Downvote a bias report on the DKG by staking TRAC tokens.

**When to use:** User wants to dispute/challenge a bias report's credibility.

**Input:**
- identifier: Either a UAL (did:dkg:otp:20430/...) or just the token ID number
- amount: Amount of TRAC to stake (e.g., "1.0" for 1 TRAC)

**Output:** Transaction confirmation with updated reputation score.

**Note:** Uses the node's configured wallet (DKG_PUBLISH_WALLET). Requires TRAC tokens.`;

const inputSchema = {
  identifier: z.string().describe("UAL (did:dkg:otp:20430/...) or token ID number"),
  amount: z.string().describe("Amount of TRAC to stake (e.g., '1.0' for 1 TRAC)"),
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

function getPrivateKey(): Hex {
  const privateKey = process.env.DKG_PUBLISH_WALLET;
  if (!privateKey) {
    throw new Error("DKG_PUBLISH_WALLET environment variable not set. Cannot vote without a wallet.");
  }

  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  return formattedKey as Hex;
}

export const registerVoteOnReport: DkgPlugin = (_, mcp) => {
  const publicClient = createPublicClient({
    chain: neurowebTestnet,
    transport: http(),
  });

  const createVoteHandler = (isUpvote: boolean) => async ({ identifier, amount }: { identifier: string; amount: string }) => {
    try {
      const privateKey = getPrivateKey();
      const account = privateKeyToAccount(privateKey);

      const walletClient = createWalletClient({
        account,
        chain: neurowebTestnet,
        transport: http(),
      });

      const tokenId = extractTokenId(identifier);
      const amountInWei = parseUnits(amount, 18);

      const balance = await publicClient.readContract({
        address: TRAC_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address],
      });

      if (balance < amountInWei) {
        const balanceFormatted = formatUnits(balance, 18);
        return {
          content: [{
            type: "text" as const,
            text: `**Insufficient TRAC balance**

Your wallet: ${account.address}
Balance: ${parseFloat(balanceFormatted).toFixed(4)} TRAC
Required: ${amount} TRAC

Get TRAC tokens on NeuroWeb Testnet to vote.`,
          }],
        };
      }

      const allowance = await publicClient.readContract({
        address: TRAC_TOKEN_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [account.address, BIAS_LENS_REPUTATION_ADDRESS],
      });

      if (allowance < amountInWei) {
        const approveHash = await walletClient.writeContract({
          address: TRAC_TOKEN_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [BIAS_LENS_REPUTATION_ADDRESS, amountInWei],
        });

        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      const voteFunction = isUpvote ? "upvote" : "downvote";
      const voteHash = await walletClient.writeContract({
        address: BIAS_LENS_REPUTATION_ADDRESS,
        abi: BIAS_LENS_REPUTATION_ABI,
        functionName: voteFunction,
        args: [tokenId, amountInWei],
      });

      await publicClient.waitForTransactionReceipt({ hash: voteHash });

      const [credibility, score, totalStaked, ual] = await Promise.all([
        publicClient.readContract({
          address: BIAS_LENS_REPUTATION_ADDRESS,
          abi: BIAS_LENS_REPUTATION_ABI,
          functionName: "getCredibility",
          args: [tokenId],
        }),
        publicClient.readContract({
          address: BIAS_LENS_REPUTATION_ADDRESS,
          abi: BIAS_LENS_REPUTATION_ABI,
          functionName: "getScore",
          args: [tokenId],
        }),
        publicClient.readContract({
          address: BIAS_LENS_REPUTATION_ADDRESS,
          abi: BIAS_LENS_REPUTATION_ABI,
          functionName: "getTotalStaked",
          args: [tokenId],
        }),
        publicClient.readContract({
          address: BIAS_LENS_REPUTATION_ADDRESS,
          abi: BIAS_LENS_REPUTATION_ABI,
          functionName: "getUAL",
          args: [tokenId],
        }),
      ]);

      const scoreNum = Number(score);
      const totalStakedFormatted = formatUnits(totalStaked, 18);
      const voteType = isUpvote ? "Upvote" : "Downvote";
      const emoji = isUpvote ? "+" : "-";

      const voteUrl = `${REPUTATION_UI_URL}?tokenId=${tokenId}`;
      const dkgExplorerUrl = `https://dkg-testnet.origintrail.io/explore?ual=${encodeURIComponent(ual)}`;
      const txUrl = `https://neuroweb-testnet.subscan.io/tx/${voteHash}`;

      return {
        content: [{
          type: "text" as const,
          text: `**${voteType} Successful!** ${emoji}${amount} TRAC

**Token #${tokenId}** - Updated Reputation

**Credibility:** ${credibility}%
**Net Score:** ${scoreNum >= 0 ? "+" : ""}${formatUnits(BigInt(scoreNum), 18)} TRAC
**Total Staked:** ${parseFloat(totalStakedFormatted).toFixed(2)} TRAC

**UAL:** ${ual}
**DKG Explorer:** ${dkgExplorerUrl}
**Transaction:** ${txUrl}

**Vote again:** ${voteUrl}`,
        }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: "text" as const,
          text: `Error ${isUpvote ? "upvoting" : "downvoting"}: ${message}`,
        }],
      };
    }
  };

  mcp.registerTool(
    upvoteName,
    { title: upvoteTitle, description: upvoteDescription, inputSchema },
    createVoteHandler(true),
  );

  mcp.registerTool(
    downvoteName,
    { title: downvoteTitle, description: downvoteDescription, inputSchema },
    createVoteHandler(false),
  );
};
