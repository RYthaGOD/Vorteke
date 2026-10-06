/**
 * Admin grant of Elite access to a wallet (5-second prices, no swap fee, linked-wallet research).
 *
 *   npx tsx scripts/grant-access.ts <wallet> [expires, default 2099-12-31]
 *
 * Writes an EliteAccess row (source 'grant'), the same record paid Elite access uses.
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
const data = { expiresAt, source: 'grant' };

prisma.eliteAccess
    .upsert({ where: { wallet }, update: data, create: { wallet, ...data } })
    .then((row) => console.log(`Granted Elite to ${row.wallet} until ${row.expiresAt.toISOString()}`))
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
