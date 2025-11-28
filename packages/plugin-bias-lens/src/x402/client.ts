import { wrapFetchWithPayment, createSigner, type Signer } from "x402-fetch";
import { x402Config } from "./config.js";

let cachedSigner: Signer | null = null;

export async function createX402FetchClient() {
  const privateKey = x402Config.clientPrivateKey;

  if (!privateKey) {
    throw new Error(
      "X402_CLIENT_PRIVATE_KEY not set - cannot make paid requests"
    );
  }

  if (!cachedSigner) {
    cachedSigner = await createSigner(x402Config.network, privateKey);
  }

  return wrapFetchWithPayment(fetch, cachedSigner);
}
