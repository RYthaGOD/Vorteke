import { TokenInfo, getDiscoveredAddresses, fetchTokenData } from '../../dataService';

/**
 * Retrieves a list of tokens based on discovery category.
 * Multi-source integration: GeckoTerminal, Pump.fun, DexScreener.
 */
export const getDiscoveryList = async (type: 'trending' | 'new' | 'gainers' | 'losers' | 'top100' | 'pumpfun' | 'captured' | 'verified'): Promise<TokenInfo[]> => {
    try {
        if (type === 'verified') {
            // 1. Fetch the list of enhanced addresses
            const listRes = await fetch('/api/enhancement/list');
            if (!listRes.ok) throw new Error("VERIFIED_LIST_DOWN");
            const addresses: string[] = await listRes.json();

            if (!addresses.length) return [];

            // 2. Fetch and scrutinize each token
            const tokens = await Promise.all(addresses.map(addr => fetchTokenData(addr)));

            // 3. Automated Safety Scrutiny
            // Must have: Verified LP, Renounced Mint, and < 40% Top 10 Concentration
            return tokens.filter(t => {
                if (!t) return false;
                const lpBurned = t.advancedMetrics?.lpBurnStatus === 'verified';
                const mintRenounced = t.advancedMetrics?.mintAuthority === 'renounced';

                // Use a descriptive check for concentration (holder concentration is often stored in advancedMetrics)
                const concentration = (t as any).holderConcentration || 0;
                const safeHolders = concentration < 40;

                return lpBurned && mintRenounced && safeHolders;
            }) as TokenInfo[];
        }

        const res = await fetch(`/api/discovery?type=${type}`);
        if (!res.ok) throw new Error(`AGGREGATOR_FAILURE: ${res.status}`);
        return await res.json();
    } catch (e) {
        console.error("VORTEX_DISCOVERY_DEGRADED:", e);
        return [];
    }
};
