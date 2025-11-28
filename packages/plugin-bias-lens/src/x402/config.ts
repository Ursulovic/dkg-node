import { privateKeyToAddress } from "viem/accounts";

const dkgWalletPrivateKey = process.env.DKG_PUBLISH_WALLET as `0x${string}` | undefined;

export const x402Config = {
  network: "base-sepolia" as const,

  serverWalletAddress: dkgWalletPrivateKey
    ? privateKeyToAddress(dkgWalletPrivateKey)
    : "",

  clientPrivateKey: process.env.DKG_PUBLISH_WALLET,

  facilitatorUrl: "https://x402.org/facilitator",

  asset: {
    address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const,
    decimals: 6,
    eip712: {
      name: "USD Coin",
      version: "2",
    },
  },
};
