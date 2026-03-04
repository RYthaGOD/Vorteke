import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as bs58 from 'bs58';

/**
 * Utility script to generate a new Solana Keypair and save it as a JSON array or Base58 string.
 */
function generate() {
    const keypair = Keypair.generate();
    const secretKeyArray = Array.from(keypair.secretKey);
    const secretKeyBase58 = bs58.default.encode(keypair.secretKey);
    const publicKey = keypair.publicKey.toBase58();

    console.log("--- VORTEKE KEY GENERATOR ---");
    console.log("PUBLIC_KEY:", publicKey);
    console.log("PRIVATE_KEY_B58:", secretKeyBase58);

    const filename = `keypair-${publicKey.slice(0, 4)}.json`;
    fs.writeFileSync(filename, JSON.stringify(secretKeyArray));

    console.log(`\n✅ Saved secret key to ${filename}`);
    console.log("--- KEEP THIS FILE SECURE ---");
}

generate();
