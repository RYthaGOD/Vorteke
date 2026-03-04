import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
    createV1,
    pluginAuthority,
    ruleSet,
    createCollectionV1,
} from '@metaplex-foundation/mpl-core';
import { createNoopSigner, generateSigner, signerIdentity } from '@metaplex-foundation/umi';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { fromWeb3JsKeypair, fromWeb3JsPublicKey } from '@metaplex-foundation/umi-web3js-adapters';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config();

const RPC = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';

async function main() {
    console.log("🚀 INITIATING VORTEKE ELITE COLLECTION GENERATION...");

    // 1. Setup Umi
    const umi = createUmi(RPC);

    // Load local authority keypair
    // Note: For actual deployment, the user points to their id.json
    const keypairPath = process.env.AUTHORITY_KEYPAIR_PATH || './authority.json';
    if (!fs.existsSync(keypairPath)) {
        console.error("❌ AUTHORITY_KEYPAIR_NOT_FOUND at ", keypairPath);
        console.log("Please ensure AUTHORITY_KEYPAIR_PATH is set in .env");
        return;
    }

    const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')));
    const keypair = Keypair.fromSecretKey(secretKey);
    const umiKeypair = fromWeb3JsKeypair(keypair);

    umi.use(signerIdentity(umiKeypair));

    console.log("Using Authority:", keypair.publicKey.toBase58());

    // 2. Create Collection
    const collectionSigner = generateSigner(umi);

    console.log("Creating Collection Mint:", collectionSigner.publicKey.toString());

    try {
        const tx = await createCollectionV1(umi, {
            collection: collectionSigner,
            name: 'Vorteke Elite Pass',
            uri: 'https://vortexsol.app/api/metadata/elite-collection', // Placeholder for Arweave/IPFS
            plugins: [
                {
                    type: 'Royalties',
                    basisPoints: 500, // 5%
                    creators: [
                        { address: fromWeb3JsPublicKey(keypair.publicKey), percentage: 100 }
                    ],
                    ruleSet: ruleSet('None'),
                }
            ]
        }).sendAndConfirm(umi);

        console.log("✅ COLLECTION_CREATED_SUCCESSFULLY!");
        console.log("TX_SIGNATURE:", tx.signature.toString());
        console.log("COLLECTION_ADDRESS:", collectionSigner.publicKey.toString());

        console.log("\n--- NEXT STEPS ---");
        console.log(`1. Update NEXT_PUBLIC_ELITE_NFT_COLLECTION in .env with: ${collectionSigner.publicKey.toString()}`);
        console.log("2. Run the asset minting script to generate the 1500 passes.");
    } catch (err) {
        console.error("❌ COLLECTION_CREATION_FAILED:", err);
    }
}

main();
