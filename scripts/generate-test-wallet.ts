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

    const filePath = path.join(process.cwd(), 'tmp', 'test-wallet.json');
    if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(walletData, null, 2));

    console.log(`TACTICAL_WALLET_GENERATED: ${publicKey}`);
    console.log(`STORAGE_PATH: ${filePath}`);

    // Provision Elite Access directly via Prisma
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    try {
        const access = await prisma.testAccess.upsert({
            where: { wallet: publicKey },
            update: {
                tier: 'Elite',
                expiresAt,
            },
            create: {
                wallet: publicKey,
                tier: 'Elite',
                expiresAt,
            },
        });

        console.log(`ELITE_PROVISIONED_SUCCESSFULLY: ${access.expiresAt}`);
    } catch (e: any) {
        console.error("PROVISION_DB_ERROR:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
