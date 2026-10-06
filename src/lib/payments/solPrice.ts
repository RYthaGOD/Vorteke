import { SOL_MINT } from '@/lib/constants';

let cached: { price: number; at: number } | null = null;
const MAX_AGE_MS = 60_000;

/** SOL/USD from Jupiter, cached for a minute. Throws when no fresh price is available. */
export async function getSolUsdPrice(): Promise<number> {
    if (cached && Date.now() - cached.at < MAX_AGE_MS) return cached.price;
    const apiKey = process.env.JUPITER_API_KEY || process.env.NEXT_PUBLIC_JUPITER_API_KEY;
    const response = await fetch('https://api.jup.ag/price/v3?ids=' + SOL_MINT, {
        headers: { Accept: 'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {}) },
        signal: AbortSignal.timeout(8000), cache: 'no-store',
    });
    if (!response.ok) throw new Error('SOL_PRICE_UNAVAILABLE');
    const body: Record<string, { usdPrice?: number }> = await response.json();
    const price = Number(body[SOL_MINT]?.usdPrice);
    if (!Number.isFinite(price) || price <= 0) throw new Error('SOL_PRICE_UNAVAILABLE');
    cached = { price, at: Date.now() };
    return price;
}
