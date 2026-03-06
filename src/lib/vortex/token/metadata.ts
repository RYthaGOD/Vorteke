import { Connection, PublicKey } from '@solana/web3.js';
import { HELIUS_RPC, HELIUS_API_KEY, RPC_ENDPOINTS } from '../../constants';
import { getResilientConnection } from '../../solana/connection';
import { throttledFetch } from '../utils';

export interface HeliusAsset {
    name: string;
    symbol: string;
    logoURI: string;
    description?: string;
    attributes?: any[];
    decimals: number;
    priceUsd: number;
    mintAuthority?: string;
    freezeAuthority?: string;
    supply?: number;
}

/**
 * Helius Digital Asset Standard (DAS) API: getAsset
 * High-fidelity metadata resolution including name, symbol, and 8K-ready logos.
 */
export const fetchHeliusMetadata = async (address: string): Promise<HeliusAsset | null> => {
    try {
        if (!HELIUS_API_KEY) return null;

        const response = await fetch(HELIUS_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 'vortex-recon',
                method: 'getAsset',
                params: { id: address }
            }),
        });

        const { result } = await response.json();
        if (!result) return null;

        return {
            name: result.content?.metadata?.name || result.content?.metadata?.symbol,
            symbol: result.content?.metadata?.symbol,
            logoURI: result.content?.links?.image || result.content?.files?.[0]?.uri,
            description: result.content?.metadata?.description,
            attributes: result.content?.metadata?.attributes,
            decimals: result.token_info?.decimals || 9,
            priceUsd: result.token_info?.price_info?.price_per_token || 0,
            mintAuthority: result.token_info?.mint_authority,
            freezeAuthority: result.token_info?.freeze_authority,
            supply: result.token_info?.supply
        };
    } catch (e) {
        console.warn("HELIUS_DAS_FAILURE:", e);
        return null;
    }
};

/**
 * Manual Metaplex Metadata Resolution
 * Decodes the on-chain metadata account without requiring external libraries.
 */
export const getMetaplexMetadata = async (mintAddress: string): Promise<{ name?: string; symbol?: string; uri?: string } | null> => {
    try {
        const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUf32SC9L4Gwf9S2EZ7WNTfGT7nGG6LJjt7Y');
        const mint = new PublicKey(mintAddress);

        // Derive Metadata PDA
        const [metadataPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('metadata'),
                TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                mint.toBuffer(),
            ],
            TOKEN_METADATA_PROGRAM_ID
        );

        const accountInfo = await getResilientConnection(c => c.getAccountInfo(metadataPDA));
        if (!accountInfo) return null;

        const data = accountInfo.data as Buffer;
        // Metaplex Layout: Skip 1 (key), 32 (auth), 32 (mint) = 65

        const decodeString = (buffer: Buffer, start: number) => {
            try {
                const strLen = buffer.readUInt32LE(start);
                if (strLen === 0 || strLen > 200) return '';
                return buffer.slice(start + 4, start + 4 + strLen).toString('utf-8').replace(/\0/g, '').trim();
            } catch { return ''; }
        };

        const name = decodeString(data, 65);
        const symbol = decodeString(data, 65 + 4 + 32);
        const uri = decodeString(data, 65 + 4 + 32 + 4 + 10);

        return { name, symbol, uri };
    } catch (e) {
        console.warn("METAPLEX_RECON_FAILURE:", e);
        return null;
    }
};
