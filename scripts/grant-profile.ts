/**
 * Admin grant of a token profile, seeded from DexScreener.
 *
 *   npx tsx scripts/grant-profile.ts <mint> [Enhanced|Elite]
 *
 * Images are expected in public/images/tokens/<mint>/{logo,banner}.jpg (committed so
 * they ship with the app); DexScreener's CDN URLs are used as a fallback.
 * Needs DATABASE_URL pointing at the target database.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'fs';
import { join } from 'path';

const [address, tierArg = 'Enhanced'] = process.argv.slice(2);
const tier = tierArg === 'Elite' ? 'Elite' : 'Enhanced';
if (!address) {
    console.error('Usage: npx tsx scripts/grant-profile.ts <mint> [Enhanced|Elite]');
    process.exit(1);
}

const prisma = new PrismaClient();

const localImage = (name: string) =>
    existsSync(join('public', 'images', 'tokens', address, name)) ? `/images/tokens/${address}/${name}` : null;

async function main() {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${address}`);
    if (!res.ok) throw new Error(`DexScreener returned ${res.status}`);
    const pairs = await res.json();
    const pair = Array.isArray(pairs) ? pairs[0] : null;
    if (!pair) throw new Error('No DexScreener pair found for this mint');

    const info = pair.info || {};
    const socials = {
        twitter: info.socials?.find((s: { type: string }) => s.type === 'twitter')?.url,
        telegram: info.socials?.find((s: { type: string }) => s.type === 'telegram')?.url,
        website: info.websites?.[0]?.url,
    };
    const iconURI = localImage('logo.jpg') || info.imageUrl || null;
    const bannerURI = localImage('banner.jpg') || info.header || null;

    await prisma.token.upsert({
        where: { address },
        update: { name: pair.baseToken.name, symbol: pair.baseToken.symbol, logoURI: iconURI, lastUpdated: new Date() },
        create: {
            address, name: pair.baseToken.name, symbol: pair.baseToken.symbol, logoURI: iconURI,
            priceUsd: Number(pair.priceUsd || 0), volume24h: pair.volume?.h24 || 0,
            liquidityUsd: pair.liquidity?.usd || 0, fdv: pair.fdv || 0, mcap: pair.marketCap || pair.fdv || 0,
        },
    });

    const profile = { tier, socials: JSON.stringify(socials), iconURI, bannerURI, lastPaymentTime: new Date() };
    await prisma.enhancement.upsert({ where: { address }, update: profile, create: { address, ...profile } });

    console.log(`Granted ${tier} profile to ${pair.baseToken.symbol} (${address})`);
    console.log({ iconURI, bannerURI, socials });
}

main()
    .catch((e) => { console.error(e); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
