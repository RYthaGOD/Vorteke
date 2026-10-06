import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getResilientConnection } from '@/lib/solana/connection';
import { primaryCreator, resolveProjectAuthorities } from '@/lib/solana/creator.mjs';
import { fetchLargestHolders, summarizeHolders } from '@/lib/scan/holders.mjs';
import { findFunder, linkHolders } from '@/lib/scan/funding.mjs';
import { requireEliteSession } from '@/lib/server/elite';

export const maxDuration = 60;

const TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 200;
const cache = new Map<string, { at: number; body: unknown }>();

/**
 * Elite research: who first funded the creator and each of the top 10 wallets, and which of
 * those wallets share a funder. Funders are read from each wallet's oldest transaction.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
    const { address } = await params;
    try { new PublicKey(address); } catch {
        return NextResponse.json({ error: 'INVALID_SOLANA_ADDRESS' }, { status: 400 });
    }
    if (!await requireEliteSession(request)) return NextResponse.json({ error: 'ELITE_REQUIRED' }, { status: 401 });

    const hit = cache.get(address);
    if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

    try {
        const [authorities, largest] = await Promise.all([
            getResilientConnection(c => resolveProjectAuthorities(c, address)),
            getResilientConnection(c => fetchLargestHolders(c, address)),
        ]);
        const creator = primaryCreator(authorities);
        const summary = summarizeHolders({ supplyRaw: largest.supplyRaw, holders: largest.holders, creatorWallets: authorities.map(a => a.wallet) });
        const wallets = summary.holders.filter(h => h.kind === 'wallet').slice(0, 10);
        const lookup = (wallet: string) => getResilientConnection(c => findFunder(c, wallet)).catch(() => ({ status: 'unknown' as const }));
        const [creatorFunding, ...fundings] = await Promise.all([creator ? lookup(creator) : Promise.resolve(null), ...wallets.map(h => lookup(h.owner))]);
        const holders = wallets.map((h, i) => ({ ...h, funding: fundings[i] }));
        const body = {
            address,
            scannedAt: new Date().toISOString(),
            creator,
            creatorFunding,
            holders,
            ...linkHolders(holders, creator),
        };
        if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
        cache.set(address, { at: Date.now(), body });
        return NextResponse.json(body);
    } catch (error) {
        console.error('ELITE_RESEARCH_ERROR', error);
        return NextResponse.json({ error: 'RESEARCH_UNAVAILABLE' }, { status: 503 });
    }
}
