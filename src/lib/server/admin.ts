import { readSession } from '@/lib/server/session.mjs';

export const adminWallet = () => process.env.NEXT_PUBLIC_ADMIN_PUBKEY || '';

/** True when the request carries an admin-scoped token issued to the configured admin wallet. */
export function isAdminRequest(request: Request): boolean {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const session = readSession(token, process.env.VORTEX_JWT_SECRET);
    return !!session && session.scope === 'admin' && !!adminWallet() && session.wallet === adminWallet();
}
