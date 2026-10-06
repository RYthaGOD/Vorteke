import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { getResilientConnection } from '@/lib/solana/connection';
import { primaryCreator, resolveProjectAuthorities } from '@/lib/solana/creator.mjs';
import { fetchLargestHolders, summarizeHolders } from '@/lib/scan/holders.mjs';

const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const TTL_MS = 120_000;
const MAX_ENTRIES = 500;
const cache = new Map<string, { at: number; body: unknown }>();

/** Free holder scan: authorities, transfer fee, creator and the largest holders, read from chain. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ address: string }> }) {
    const { address } = await params;
    try { new PublicKey(address); } catch {
        return NextResponse.json({ error: 'INVALID_SOLANA_ADDRESS' }, { status: 400 });
    }
    const hit = cache.get(address);
    if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body, { headers: { 'Cache-Control': 'public, max-age=60' } });

    try {
        const mintInfo = await getResilientConnection(c => c.getParsedAccountInfo(new PublicKey(address)));
        const data = mintInfo.value?.data;
        const info = data && 'parsed' in data && data.parsed?.type === 'mint' ? data.parsed.info : null;
        if (!info) return NextResponse.json({ error: 'NOT_A_TOKEN' }, { status: 404 });

        const [authorities, largest] = await Promise.all([
            getResilientConnection(c => resolveProjectAuthorities(c, address)),
            getResilientConnection(c => fetchLargestHolders(c, address)),
        ]);
        const summary = summarizeHolders({ supplyRaw: largest.supplyRaw, holders: largest.holders, creatorWallets: authorities.map(a => a.wallet) });
        const fee = info.extensions?.find((e: { extension: string }) => e.extension === 'transferFeeConfig')?.state;
        const creator = primaryCreator(authorities);
        const body = {
            address,
            scannedAt: new Date().toISOString(),
            program: mintInfo.value?.owner.toBase58() === TOKEN_2022 ? 'Token-2022' : 'SPL Token',
            mintAuthority: info.mintAuthority ?? null,
            freezeAuthority: info.freezeAuthority ?? null,
            transferFeeBps: fee?.newerTransferFee?.transferFeeBasisPoints ?? fee?.olderTransferFee?.transferFeeBasisPoints ?? 0,
            creator,
            creatorSource: authorities.find(a => a.wallet === creator)?.source ?? null,
            ...summary,
            holders: summary.holders.slice(0, 10),
        };
        if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
        cache.set(address, { at: Date.now(), body });
        return NextResponse.json(body, { headers: { 'Cache-Control': 'public, max-age=60' } });
    } catch (error) {
        console.error('HOLDER_SCAN_ERROR', error);
        return NextResponse.json({ error: 'SCAN_UNAVAILABLE' }, { status: 503 });
    }
}
