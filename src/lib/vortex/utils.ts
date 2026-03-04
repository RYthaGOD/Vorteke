// Rate Limiting Mitigation: Global Domain Throttled Fetcher
const domainThrottleMap = new Map<string, number>();

/**
 * Throttled fetch implementation to respect external API rate limits.
 */
export const throttledFetch = async (url: string, delay: number = 2000): Promise<any> => {
    let retries = 0;
    const maxRetries = 3;

    // Extract domain for global rate limiting per domain
    const domain = new URL(url.startsWith('/') ? `http://localhost${url}` : url).hostname;

    while (retries <= maxRetries) {
        const now = Date.now();
        const lastFetch = domainThrottleMap.get(domain) || 0;
        if (now - lastFetch < delay) {
            await new Promise(resolve => setTimeout(resolve, delay - (now - lastFetch)));
        }

        try {
            domainThrottleMap.set(domain, Date.now());
            const res = await fetch(url);

            if (res.status === 429) {
                retries++;
                const retryAfter = res.headers.get('Retry-After');
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delay * retries;
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            if (!res.ok) throw new Error(`HTTP_${res.status}`);
            return await res.json();
        } catch (e: any) {
            retries++;
            if (retries > maxRetries) throw e;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
};

/**
 * Sleeps for a specified duration.
 */
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
