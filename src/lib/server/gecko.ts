// GeckoTerminal market data with a shared in-memory cache. With COINGECKO_API_KEY set, the same
// paths go to CoinGecko's paid on-chain API, which has much higher rate limits than the free tier.
const KEY = process.env.COINGECKO_API_KEY || '';
const BASE = KEY ? 'https://pro-api.coingecko.com/api/v3/onchain' : 'https://api.geckoterminal.com/api/v2';
const MAX_ENTRIES = 300;

const store = new Map<string, { at: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function fetchJson(path: string): Promise<unknown> {
    const response = await fetch(BASE + path, {
        headers: { Accept: 'application/json', ...(KEY ? { 'x-cg-pro-api-key': KEY } : {}) },
        signal: AbortSignal.timeout(12_000), cache: 'no-store',
    });
    if (!response.ok) throw new Error('MARKET_PROVIDER_' + response.status);
    return response.json();
}

/**
 * A provider response, reused while fresh. When the provider fails or rate-limits, the last good
 * answer is served with `stale: true` instead of an error. Concurrent requests share one fetch.
 */
export async function geckoJson<T>(path: string, freshMs = 30_000): Promise<{ data: T; at: number; stale: boolean }> {
    const hit = store.get(path);
    if (hit && Date.now() - hit.at < freshMs) return { data: hit.value as T, at: hit.at, stale: false };
    try {
        let pending = inflight.get(path);
        if (!pending) {
            pending = fetchJson(path).finally(() => inflight.delete(path));
            inflight.set(path, pending);
        }
        const value = await pending;
        if (!store.has(path) && store.size >= MAX_ENTRIES) store.delete(store.keys().next().value!);
        const at = Date.now();
        store.set(path, { at, value });
        return { data: value as T, at, stale: false };
    } catch (error) {
        if (hit) return { data: hit.value as T, at: hit.at, stale: true };
        throw error;
    }
}

export const dataHeaders = (at: number, stale: boolean) => ({ 'X-Data-Updated': new Date(at).toISOString(), 'X-Data-Stale': stale ? '1' : '0' });
