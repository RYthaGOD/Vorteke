import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { prisma } from '@/lib/prisma';
import { isAdminRequest } from '@/lib/server/admin';
import { extendExpiry } from '@/lib/profiles.mjs';

const HOUR_MS = 3_600_000;
const isKey = (value: unknown): value is string => { try { return typeof value === 'string' && !!new PublicKey(value); } catch { return false; } };

/**
 * Admin actions. Profiles: clear-media, revoke-claim, set-owner, boost (hours), set-tier.
 * Elite: grant-elite (days), revoke-elite. Every action is logged.
 */
export async function POST(request: NextRequest) {
    if (!isAdminRequest(request)) return NextResponse.json({ error: 'NOT_ADMIN' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const { action, address, wallet } = body;
    try {
        switch (action) {
            case 'clear-media':
            case 'revoke-claim':
            case 'set-owner':
            case 'boost':
            case 'set-tier': {
                if (!isKey(address)) return NextResponse.json({ error: 'INVALID_ADDRESS' }, { status: 400 });
                const current = await prisma.enhancement.findUnique({ where: { address } });
                let data: Record<string, unknown>;
                if (action === 'clear-media') data = { bannerURI: null, iconURI: null, socials: null, customDescription: null };
                else if (action === 'revoke-claim') data = { owner: null };
                else if (action === 'set-owner') {
                    if (!isKey(wallet)) return NextResponse.json({ error: 'INVALID_WALLET' }, { status: 400 });
                    data = { owner: wallet };
                } else if (action === 'boost') {
                    const hours = Number(body.hours);
                    if (!Number.isFinite(hours) || hours === 0 || Math.abs(hours) > 24 * 365) return NextResponse.json({ error: 'INVALID_HOURS' }, { status: 400 });
                    data = { boostExpiresAt: hours > 0 ? extendExpiry(current?.boostExpiresAt, hours * HOUR_MS) : null };
                } else {
                    if (!['Basic', 'Enhanced'].includes(body.tier)) return NextResponse.json({ error: 'INVALID_TIER' }, { status: 400 });
                    data = { tier: body.tier };
                }
                const profile = await prisma.enhancement.upsert({ where: { address }, update: data, create: { address, ...data } });
                console.log(JSON.stringify({ level: 'ADMIN_ACTION', action, address, data, at: new Date().toISOString() }));
                return NextResponse.json({ success: true, profile });
            }
            case 'grant-elite':
            case 'revoke-elite': {
                if (!isKey(wallet)) return NextResponse.json({ error: 'INVALID_WALLET' }, { status: 400 });
                if (action === 'revoke-elite') {
                    await prisma.eliteAccess.deleteMany({ where: { wallet } });
                } else {
                    const days = Number(body.days);
                    if (!Number.isFinite(days) || days <= 0 || days > 3650) return NextResponse.json({ error: 'INVALID_DAYS' }, { status: 400 });
                    const current = await prisma.eliteAccess.findUnique({ where: { wallet } });
                    const expiresAt = extendExpiry(current?.expiresAt, days * 24 * HOUR_MS);
                    await prisma.eliteAccess.upsert({ where: { wallet }, update: { expiresAt, source: 'grant' }, create: { wallet, expiresAt, source: 'grant' } });
                }
                console.log(JSON.stringify({ level: 'ADMIN_ACTION', action, wallet, days: body.days, at: new Date().toISOString() }));
                return NextResponse.json({ success: true });
            }
            default:
                return NextResponse.json({ error: 'UNKNOWN_ACTION' }, { status: 400 });
        }
    } catch (error) {
        console.error('ADMIN_ACTION_ERROR', error);
        return NextResponse.json({ error: 'ACTION_FAILED' }, { status: 500 });
    }
}
