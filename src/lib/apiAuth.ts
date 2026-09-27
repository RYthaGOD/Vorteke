import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Monthly request caps per tier. Keep in sync with README.md / docs/PRICING.md.
export const TIER_LIMITS: Record<string, number> = {
    free: 50_000,
    starter: 5_000_000,
    pro: 50_000_000,
    enterprise: Infinity,
};

const PERIOD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface ApiKeyContext {
    key: string;
    email: string;
    tier: string;
}

type AuthResult =
    | { ok: true; ctx: ApiKeyContext }
    | { ok: false; response: NextResponse };

/**
 * Validates the Authorization: Bearer <key> header against ApiKey records,
 * resets the usage counter if the 30-day period has elapsed, and rejects
 * requests once the tier's monthly cap is hit. Increments usage on success.
 */
export async function requireApiKey(req: NextRequest): Promise<AuthResult> {
    const authHeader = req.headers.get('authorization') || '';
    const match = authHeader.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'MISSING_API_KEY', message: 'Provide Authorization: Bearer <key>' },
                { status: 401 }
            ),
        };
    }

    const key = match[1].trim();
    const record = await prisma.apiKey.findUnique({ where: { key } });

    if (!record || record.revoked) {
        return {
            ok: false,
            response: NextResponse.json({ error: 'INVALID_API_KEY' }, { status: 401 }),
        };
    }

    const now = Date.now();
    const periodElapsed = now - record.periodStart.getTime() > PERIOD_MS;
    const currentCount = periodElapsed ? 0 : record.requestsThisPeriod;
    const limit = TIER_LIMITS[record.tier] ?? TIER_LIMITS.free;

    if (currentCount >= limit) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: 'RATE_LIMIT_EXCEEDED', message: `Monthly limit of ${limit} requests reached for tier "${record.tier}"` },
                { status: 429 }
            ),
        };
    }

    await prisma.apiKey.update({
        where: { key },
        data: periodElapsed
            ? { requestsThisPeriod: 1, periodStart: new Date(), lastUsedAt: new Date() }
            : { requestsThisPeriod: { increment: 1 }, lastUsedAt: new Date() },
    });

    return { ok: true, ctx: { key: record.key, email: record.email, tier: record.tier } };
}
