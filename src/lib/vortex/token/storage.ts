import { TokenInfo } from './types';

const RECENTLY_VIEWED_KEY = 'vortex_recent_tokens';
const DISCOVERED_TOKENS_KEY = 'vortex_discovered';

export const registerRecentlyViewed = (token: TokenInfo) => {
    if (typeof window === 'undefined') return;
    try {
        const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
        let current: any[] = stored ? JSON.parse(stored) : [];
        current = [token, ...current.filter(t => t.address !== token.address)].slice(0, 10);
        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(current));
    } catch (e) { }
};

export const getRecentlyViewed = (): TokenInfo[] => {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

export const getDiscoveredAddresses = (): string[] => {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(DISCOVERED_TOKENS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch { return []; }
};

export const registerDiscoveredToken = (address: string) => {
    if (typeof window === 'undefined') return;
    const current = getDiscoveredAddresses();
    if (!current.includes(address)) {
        const updated = [address, ...current].slice(0, 50);
        localStorage.setItem(DISCOVERED_TOKENS_KEY, JSON.stringify(updated));
    }
};
