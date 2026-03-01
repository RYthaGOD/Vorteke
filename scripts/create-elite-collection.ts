import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { createCollection } from '@metaplex-foundation/mpl-core';
import { generateSigner, keypairIdentity } from '@metaplex-foundation/umi';
import * as fs from 'fs';

/**
 * VORTEX ELITE - METAPLEX CORE COLLECTION GENERATOR
 * Uses the highly optimized Metaplex Core standard for the Elite Pass.
 */
import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';

async function main() {
    console.log("INITIALIZING METAPLEX UMI...");
    // Using Testnet to bypass Devnet airdrop failures
    const rpc = 'https://api.testnet.solana.com';
    const umi = createUmi(rpc);
    const conn = new Connection(rpc, 'confirmed');

    // 1. Identify Authority Keypair
    const walletFile = process.env.AUTHORITY_KEYPAIR_PATH || './admin-key.json';
    if (!fs.existsSync(walletFile)) {
        console.error(`[!] ERROR: Keypair not found at ${walletFile}`);
        process.exit(1);
    }

    const secretKey = new Uint8Array(JSON.parse(fs.readFileSync(walletFile, 'utf8')));
    const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    umi.use(keypairIdentity(keypair));

    console.log(`AUTHORITY PUBKEY: ${keypair.publicKey}`);

    let funded = false;
    for (let i = 0; i < 3; i++) {
        try {
            console.log(`[+] Requesting Testnet Airdrop to fund deployment (Attempt ${i + 1})...`);
            const sig = await conn.requestAirdrop(new PublicKey(keypair.publicKey), LAMPORTS_PER_SOL);
            await conn.confirmTransaction(sig, 'confirmed');
            console.log(`[+] Airdrop successful.`);
            funded = true;
            break;
        } catch (e) {
            console.warn(`[!] Airdrop attempt failed. Retrying in 2 seconds...`);
            await new Promise(r => setTimeout(r, 2000));
        }
    }

    if (!funded) {
        console.error(`[!] FATAL: Could not fund wallet from faucet. Exiting...`);
        process.exit(1);
    }

    // 2. Generate new Collection Mint Signer
    const collectionMint = generateSigner(umi);

    console.log(`\nGENERATING NEW CORE COLLECTION...`);
    console.log(`TARGET MINT: ${collectionMint.publicKey}`);

    try {
        await createCollection(umi, {
            collection: collectionMint,
            name: 'Vortex Elite Pass',
            // Defaulting to a high-fidelity IPFS/Arweave JSON metadata URI for the Elite Pass Collection
            uri: 'https://vortex.com/metadata/elite-pass-collection.json',
        }).sendAndConfirm(umi);

        console.log(`\n[+] SUCCESS: Elite NFT Collection Created!`);
        console.log(`\n========================================================`);
        console.log(`Update your .env and .env.local with:`);
        console.log(`NEXT_PUBLIC_ELITE_NFT_COLLECTION=${collectionMint.publicKey}`);
        console.log(`========================================================\n`);

    } catch (e) {
        console.error("\n[!] FATAL EXECUTION ERROR:", e);
    }
}

main();
