import { PublicKey } from '@solana/web3.js';

// Owners whose tokens are out of circulation.
const BURN_OWNERS = new Set(['1nc1nerator11111111111111111111111111111111', '11111111111111111111111111111111']);

const round = n => Math.round(n * 100) / 100;

/**
 * A plain summary of a token's largest holders. Accounts owned by a program (pools, bonding
 * curves, lockers) are listed but kept out of wallet concentration, since no single person holds them.
 * @param {{ supplyRaw: string | bigint, holders: { owner: string, amountRaw: string | bigint, onCurve: boolean }[], creatorWallets?: string[] }} input
 * @returns {{ holders: { owner: string, percent: number, kind: 'wallet' | 'program' | 'burn', isCreator: boolean }[], top10WalletPercent: number, programPercent: number, burnedPercent: number, creatorPercent: number, riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' }}
 */
export function summarizeHolders({ supplyRaw, holders, creatorWallets = [] }) {
    const supply = BigInt(supplyRaw);
    const byOwner = new Map();
    for (const holder of holders) {
        const current = byOwner.get(holder.owner);
        byOwner.set(holder.owner, { ...holder, amountRaw: (current ? BigInt(current.amountRaw) : 0n) + BigInt(holder.amountRaw) });
    }
    const percent = raw => supply > 0n ? Number((raw * 1_000_000n) / supply) / 10_000 : 0;
    const rows = [...byOwner.values()]
        .sort((a, b) => (b.amountRaw > a.amountRaw ? 1 : b.amountRaw < a.amountRaw ? -1 : 0))
        .map(h => ({
            owner: h.owner,
            percent: percent(h.amountRaw),
            kind: BURN_OWNERS.has(h.owner) ? 'burn' : h.onCurve ? 'wallet' : 'program',
            isCreator: creatorWallets.includes(h.owner),
        }));
    const sum = list => round(list.reduce((total, row) => total + row.percent, 0));
    const top10WalletPercent = sum(rows.filter(r => r.kind === 'wallet').slice(0, 10));
    return {
        holders: rows,
        top10WalletPercent,
        programPercent: sum(rows.filter(r => r.kind === 'program')),
        burnedPercent: sum(rows.filter(r => r.kind === 'burn')),
        creatorPercent: sum(rows.filter(r => r.isCreator)),
        riskLevel: top10WalletPercent > 70 ? 'HIGH' : top10WalletPercent > 50 ? 'MEDIUM' : 'LOW',
    };
}

/**
 * Reads the largest token accounts and their owners.
 * @param {import('@solana/web3.js').Connection} connection
 * @param {string} mint
 */
export async function fetchLargestHolders(connection, mint) {
    const key = new PublicKey(mint);
    const [largest, supply] = await Promise.all([connection.getTokenLargestAccounts(key), connection.getTokenSupply(key)]);
    const accounts = largest.value.slice(0, 20);
    const parsed = await connection.getMultipleParsedAccounts(accounts.map(a => a.address));
    const holders = accounts.flatMap((account, i) => {
        const data = parsed.value[i]?.data;
        const owner = data && 'parsed' in data ? data.parsed?.info?.owner : null;
        if (typeof owner !== 'string') return [];
        return [{ owner, amountRaw: account.amount, onCurve: PublicKey.isOnCurve(new PublicKey(owner).toBytes()) }];
    });
    return { supplyRaw: supply.value.amount, decimals: supply.value.decimals, holders };
}
