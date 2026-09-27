/**
 * Minimal fetch-based client for the VORTEX API.
 * Not published to npm — vendor this file directly until it is.
 */
export class VortexAPI {
    constructor({ baseUrl, apiKey }) {
        if (!baseUrl) throw new Error('VortexAPI: baseUrl is required');
        if (!apiKey) throw new Error('VortexAPI: apiKey is required');
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiKey = apiKey;

        this.tokens = {
            trending: (opts = {}) => this._get('/api/v1/tokens/trending', opts),
        };
    }

    async _get(path, params = {}) {
        const url = new URL(this.baseUrl + path);
        for (const [k, v] of Object.entries(params)) {
            if (v !== undefined) url.searchParams.set(k, String(v));
        }

        const res = await fetch(url, {
            headers: { Authorization: `Bearer ${this.apiKey}` },
        });

        const body = await res.json();
        if (!res.ok) {
            const err = new Error(body?.message || body?.error || `VortexAPI request failed (${res.status})`);
            err.status = res.status;
            err.body = body;
            throw err;
        }
        return body;
    }
}
