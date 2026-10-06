import { PublicKey } from '@solana/web3.js';

// A wallet with this many signatures or more is treated as long-lived, and its first funder isn't looked up.
export const HISTORY_LIMIT = 1000;

/** The SOL transfer (or account creation) that paid into `wallet` within a parsed transaction. */
export function findIncomingTransfer(tx, wallet) {
    if (!tx?.transaction?.message) return null;
    const instructions = [
        ...tx.transaction.message.instructions,
        ...(tx.meta?.innerInstructions ?? []).flatMap(inner => inner.instructions),
    ];
    for (const ix of instructions) {
        if (ix.program !== 'system' || !ix.parsed) continue;
        const { type, info } = ix.parsed;
        if (type === 'transfer' && info.destination === wallet && info.source !== wallet) return { source: info.source, lamports: Number(info.lamports) };
        if (type === 'createAccount' && info.newAccount === wallet && info.source !== wallet) return { source: info.source, lamports: Number(info.lamports) };
    }
    return null;
}

/**
 * Who first sent SOL to a wallet, read from its oldest transaction.
 * @param {import('@solana/web3.js').Connection} connection
 * @returns {Promise<{ status: 'found', funder: string, signature: string } | { status: 'established' | 'empty' | 'unknown' }>}
 */
export async function findFunder(connection, wallet) {
    const signatures = await connection.getSignaturesForAddress(new PublicKey(wallet), { limit: HISTORY_LIMIT });
    if (signatures.length === 0) return { status: 'empty' };
    if (signatures.length >= HISTORY_LIMIT) return { status: 'established' };
    const oldest = signatures[signatures.length - 1];
    const tx = await connection.getParsedTransaction(oldest.signature, { maxSupportedTransactionVersion: 0 });
    const transfer = findIncomingTransfer(tx, wallet);
    return transfer ? { status: 'found', funder: transfer.source, signature: oldest.signature } : { status: 'unknown' };
}

/**
 * Groups holders that share a first funder. A group of two or more wallets, or wallets funded by
 * the creator, are the patterns worth a closer look; a shared funder can also be an exchange.
 * @param {{ owner: string, percent: number, funding: { status: string, funder?: string } }[]} holders
 * @param {string | null} creator
 */
export function linkHolders(holders, creator) {
    const groups = new Map();
    for (const holder of holders) {
        if (holder.funding?.status !== 'found') continue;
        const list = groups.get(holder.funding.funder) ?? [];
        list.push(holder);
        groups.set(holder.funding.funder, list);
    }
    const round = n => Math.round(n * 100) / 100;
    const linked = [...groups.entries()]
        .filter(([funder, list]) => list.length >= 2 || funder === creator)
        .map(([funder, list]) => ({
            funder,
            fundedByCreator: funder === creator,
            wallets: list.map(h => h.owner),
            percent: round(list.reduce((total, h) => total + h.percent, 0)),
        }))
        .sort((a, b) => b.percent - a.percent);
    return { linked, linkedPercent: round(linked.reduce((total, g) => total + g.percent, 0)) };
}
