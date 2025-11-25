const COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedPrice {
  rate: number;
  timestamp: number;
}

let cachedPrice: CachedPrice | null = null;

export async function getTracUsdRate(): Promise<number> {
  if (cachedPrice && Date.now() - cachedPrice.timestamp < CACHE_TTL_MS) {
    return cachedPrice.rate;
  }

  try {
    const response = await fetch(
      `${COINGECKO_API}?ids=origintrail&vs_currencies=usd`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = (await response.json()) as { origintrail?: { usd?: number } };
    const rate = data.origintrail?.usd;

    if (typeof rate === "number" && rate > 0) {
      cachedPrice = { rate, timestamp: Date.now() };
      return rate;
    }

    throw new Error("Invalid price data from CoinGecko");
  } catch (error) {
    console.warn(
      "Failed to fetch TRAC price from CoinGecko:",
      error instanceof Error ? error.message : error
    );
  }

  return Number(process.env.TRAC_USD_RATE) || 0.5;
}

export function clearPriceCache(): void {
  cachedPrice = null;
}
