export const x402Config = {
  network: "base-sepolia" as const,

  serverWalletAddress: process.env.PUBLISHER_WALLET_ADDRESS ?? "",

  clientPrivateKey: process.env.X402_CLIENT_PRIVATE_KEY,

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
