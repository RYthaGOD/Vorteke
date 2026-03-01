import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';

const KEY_PATH = './admin-key.json';

if (!fs.existsSync(KEY_PATH)) {
    const keypair = Keypair.generate();
    fs.writeFileSync(KEY_PATH, JSON.stringify(Array.from(keypair.secretKey)));
    console.log(`[+] SUCCESS: Generated new Deployer Keypair at ${KEY_PATH}`);
    console.log(`[!] PUBLIC KEY: ${keypair.publicKey.toBase58()}`);
    console.log(`[!] ACTION REQUIRED: Fund this wallet with SOL to deploy the Metaplex Collection.`);
} else {
    console.log(`[*] Keypair already exists at ${KEY_PATH}`);
}
