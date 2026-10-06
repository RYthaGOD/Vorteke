import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/server/admin';

export const dynamic = 'force-dynamic';

/** Recent payments, revenue by product, profiles, active boosts and Elite wallets. */
export async function GET(request: NextRequest) {
    if (!isAdminRequest(request)) return NextResponse.json({ error: 'NOT_ADMIN' }, { status: 401 });
    const now = new Date();
    const since = new Date(now.getTime() - 13 * 86_400_000).toISOString().slice(0, 10);
    const [receipts, totals, profiles, eliteAccess, funnel] = await Promise.all([
        prisma.paymentReceipt.findMany({ orderBy: { createdAt: 'desc' }, take: 50, include: { intent: true } }),
        prisma.paymentIntent.groupBy({ by: ['tier'], where: { receipt: { isNot: null } }, _count: { _all: true }, _sum: { lamports: true, usdCents: true } }),
        prisma.enhancement.findMany({ where: { OR: [{ owner: { not: null } }, { tier: { not: 'Basic' } }, { boostExpiresAt: { gt: now } }] }, orderBy: { lastPaymentTime: 'desc' }, take: 200 }),
        prisma.eliteAccess.findMany({ where: { expiresAt: { gt: now } }, orderBy: { expiresAt: 'desc' }, take: 200 }),
        prisma.funnelEvent.groupBy({ by: ['name'], where: { day: { gte: since } }, _sum: { count: true } }),
    ]);
    return NextResponse.json({
        payments: receipts.map(r => ({ signature: r.signature, at: r.createdAt, product: r.intent.tier, wallet: r.intent.wallet, address: r.intent.address, lamports: r.intent.lamports, usdCents: r.intent.usdCents })),
        totals: totals.map(t => ({ product: t.tier, count: t._count._all, lamports: t._sum.lamports ?? 0, usdCents: t._sum.usdCents ?? 0 })),
        profiles: profiles.map(p => ({ address: p.address, tier: p.tier, owner: p.owner, boostExpiresAt: p.boostExpiresAt, hasMedia: !!(p.bannerURI || p.iconURI || p.socials || p.customDescription), lastPaymentTime: p.lastPaymentTime })),
        elite: eliteAccess.map(e => ({ wallet: e.wallet, expiresAt: e.expiresAt, source: e.source })),
        funnel: Object.fromEntries(funnel.map(f => [f.name, f._sum.count ?? 0])),
    });
}
