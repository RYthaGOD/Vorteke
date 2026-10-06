import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const keypair = Keypair.generate();
    const publicKey = keypair.publicKey.toBase58();
    const secretKey = Array.from(keypair.secretKey);

    const walletData = {
        publicKey,
        secretKey,
        generatedAt: new Date().toISOString()
    };

    // .scratch/ is git-ignored. Never commit a wallet file: this repository is public.
    const filePath = path.join(process.cwd(), '.scratch', 'test-wallet.json');
    if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));

    console.log(`Test wallet: ${publicKey}`);
    console.log(`Saved to: ${filePath}`);

    // Provision Elite Access directly via Prisma
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
        const access = await prisma.eliteAccess.upsert({
            where: { wallet: publicKey },
            update: { expiresAt, source: 'grant' },
            create: { wallet: publicKey, expiresAt, source: 'grant' },
        });

        console.log(`Elite granted until ${access.expiresAt.toISOString()}`);
    } catch (e: any) {
        console.error("PROVISION_DB_ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
