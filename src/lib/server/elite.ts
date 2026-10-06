import { prisma } from '@/lib/prisma';
import { readSession } from '@/lib/server/session.mjs';

/** When a wallet's Elite access ends: a far date for the admin wallet, null when it has none. */
export async function eliteAccessUntil(wallet: string): Promise<Date | null> {
    if (process.env.NEXT_PUBLIC_ADMIN_PUBKEY && wallet === process.env.NEXT_PUBLIC_ADMIN_PUBKEY) return new Date('2099-12-31T00:00:00Z');
    const access = await prisma.eliteAccess.findUnique({ where: { wallet } });
    return access && access.expiresAt > new Date() ? access.expiresAt : null;
}

/** The Elite wallet behind a request's bearer token, re-checked against current access. */
export async function requireEliteSession(request: Request): Promise<string | null> {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const session = readSession(token, process.env.VORTEX_JWT_SECRET);
    if (!session) return null;
    return (await eliteAccessUntil(session.wallet)) ? session.wallet : null;
}
