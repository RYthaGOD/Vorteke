import { PublicKey } from '@solana/web3.js';

export const PUMP_PROGRAM = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';
export const METAPLEX_METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s';
const EMPTY_KEY = '11111111111111111111111111111111';

export function pumpBondingCurveAddress(mint) {
    return PublicKey.findProgramAddressSync([Buffer.from('bonding-curve'), new PublicKey(mint).toBuffer()], new PublicKey(PUMP_PROGRAM))[0];
}

export function metaplexMetadataAddress(mint) {
    const program = new PublicKey(METAPLEX_METADATA_PROGRAM);
    return PublicKey.findProgramAddressSync([Buffer.from('metadata'), program.toBuffer(), new PublicKey(mint).toBuffer()], program)[0];
}

// Bonding curve layout: 8-byte discriminator, five u64 reserves, a `complete` flag, then the creator.
// Curves created before Pump.fun added the creator field are shorter and carry no creator.
export function parsePumpCreator(data) {
    if (!data || data.length < 81) return null;
    const creator = new PublicKey(data.subarray(49, 81)).toBase58();
    return creator === EMPTY_KEY ? null : creator;
}

// Metaplex metadata layout: a 1-byte account key, then the 32-byte update authority.
export function parseMetaplexUpdateAuthority(data) {
    if (!data || data.length < 33) return null;
    const authority = new PublicKey(data.subarray(1, 33)).toBase58();
    return authority === EMPTY_KEY ? null : authority;
}

/**
 * Wallets that can prove they run a token's project, read from chain state on the server.
 * Never trust a creator supplied by a browser. For Pump.fun tokens the metadata update
 * authority belongs to the launchpad, not the team, so only the curve's creator counts.
 * @param {{ getParsedAccountInfo: Function, getMultipleAccountsInfo: Function }} connection
 * @param {string} mint
 * @returns {Promise<{ wallet: string, source: string }[]>}
 */
export async function resolveProjectAuthorities(connection, mint) {
    const mintKey = new PublicKey(mint);
    const curve = pumpBondingCurveAddress(mintKey);
    const metadata = metaplexMetadataAddress(mintKey);
    const [mintInfo, [curveAccount, metadataAccount]] = await Promise.all([
        connection.getParsedAccountInfo(mintKey),
        connection.getMultipleAccountsInfo([curve, metadata]),
    ]);
    const data = mintInfo?.value?.data;
    const info = data && typeof data === 'object' && 'parsed' in data && data.parsed?.type === 'mint' ? data.parsed.info : null;
    if (!info) return [];

    const found = [];
    if (info.mintAuthority) found.push({ wallet: info.mintAuthority, source: 'mint-authority' });
    const pumpCreator = curveAccount?.owner?.toBase58() === PUMP_PROGRAM ? parsePumpCreator(curveAccount.data) : null;
    if (pumpCreator) {
        found.push({ wallet: pumpCreator, source: 'pump-creator' });
    } else {
        const tokenMetadata = info.extensions?.find(e => e.extension === 'tokenMetadata')?.state;
        if (tokenMetadata?.updateAuthority) found.push({ wallet: tokenMetadata.updateAuthority, source: 'token-metadata-authority' });
        const metaplexAuthority = metadataAccount?.owner?.toBase58() === METAPLEX_METADATA_PROGRAM ? parseMetaplexUpdateAuthority(metadataAccount.data) : null;
        if (metaplexAuthority) found.push({ wallet: metaplexAuthority, source: 'metadata-update-authority' });
    }
    return found.filter((entry, i) => found.findIndex(other => other.wallet === entry.wallet) === i);
}

/** The single wallet shown as a token's creator: the Pump.fun creator first, then the other authorities in order. */
export function primaryCreator(authorities) {
    return (authorities.find(a => a.source === 'pump-creator') || authorities[0])?.wallet ?? null;
}
