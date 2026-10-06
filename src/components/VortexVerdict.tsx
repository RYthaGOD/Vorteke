'use client';
import React from 'react';
import { TokenInfo, VortexTx } from '@/lib/dataService';
import { VortexPanel } from '@/components/DesignSystem';

interface VortexVerdictProps {
    token: TokenInfo;
    recentTxs: VortexTx[];
}

/** Plain counts from the trades seen on this page. A summary of activity, not a rating or advice. */
export function VortexVerdict({ token, recentTxs }: VortexVerdictProps) {
    const buys = recentTxs.filter(tx => tx.type === 'BUY');
    const sells = recentTxs.filter(tx => tx.type === 'SELL');
    const largeBuys = buys.filter(tx => tx.amountSol > 10).length;
    const devSells = recentTxs.filter(tx => tx.labels?.includes('DEV_DUMP')).length;
    const volume = (list: VortexTx[]) => list.reduce((total, tx) => total + (Number.isFinite(tx.amountSol) ? tx.amountSol : 0), 0);
    const concentration = token.advancedMetrics?.holderIntelligence?.riskLevel;

    const rows: [string, string][] = [
        ['Trades seen', `${recentTxs.length} (${buys.length} buys, ${sells.length} sells)`],
        ['Buy volume', volume(buys).toFixed(2) + ' SOL'],
        ['Sell volume', volume(sells).toFixed(2) + ' SOL'],
        ['Buys over 10 SOL', String(largeBuys)],
        ['Sells by the creator', String(devSells)],
        ['Top 10 wallet concentration', concentration === 'HIGH' ? 'Very high' : concentration === 'MEDIUM' ? 'High' : concentration === 'LOW' ? 'Moderate or low' : 'Unavailable'],
    ];

    return (
        <VortexPanel title="Recent activity" subTitle="Trades seen since you opened this page" glowColor="none">
            <dl className="vortex-check-list">
                {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
            </dl>
            <p className="vortex-disclosure">Counts cover only the trades streamed to this page. This is a summary, not a rating or advice.</p>
        </VortexPanel>
    );
}
