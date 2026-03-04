import { TokenInfo, getDiscoveredAddresses, fetchTokenData } from '../../dataService';

/**
 * Retrieves a list of tokens based on discovery category.
 * Multi-source integration: GeckoTerminal, Pump.fun, DexScreener.
 */
export const getDiscoveryList = async (type: 'trending' | 'new' | 'gainers' | 'losers' | 'top100' | 'pumpfun' | 'captured'): Promise<TokenInfo[]> => {
    try {
        const res = await fetch(`/api/discovery?type=${type}`);
        if (!res.ok) throw new Error(`AGGREGATOR_FAILURE: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("VORTEX_DISCOVERY_DEGRADED:", e);
        return [];
    }
};
