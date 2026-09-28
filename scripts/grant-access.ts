/**
 * Admin grant of Elite access to a wallet (Elite workspace, no swap fee, free DeepScans).
 *
 *   npx tsx scripts/grant-access.ts <wallet> [expires, default 2099-12-31]
 *
 * Writes a TestAccess row, the same record /api/auth/elite-check reads.
 * Needs DATABASE_URL pointing at the target database.
 */
import { PrismaClient } from '@prisma/client';
import { PublicKey } from '@solana/web3.js';

const [wallet, expires = '2099-12-31'] = process.argv.slice(2);
if (!wallet) {
    console.error('Usage: npx tsx scripts/grant-access.ts <wallet> [YYYY-MM-DD]');
    process.exit(1);
}
new PublicKey(wallet); // throws on an invalid address

const expiresAt = new Date(`${expires}T00:00:00Z`);
if (Number.isNaN(expiresAt.getTime())) throw new Error(`Invalid expiry date: ${expires}`);

const prisma = new PrismaClient();
const data = { tier: 'Elite', expiresAt };

prisma.testAccess
    .upsert({ where: { wallet }, update: data, create: { wallet, ...data } })
    .then((row) => console.log(`Granted ${row.tier} to ${row.wallet} until ${row.expiresAt.toISOString()}`))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
