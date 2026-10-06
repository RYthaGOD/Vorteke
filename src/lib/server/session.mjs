import { createHmac, timingSafeEqual } from 'node:crypto';

// Short signed tokens proving a wallet signed in with Elite access. Format: base64url(payload).base64url(hmac).
const encode = value => Buffer.from(value).toString('base64url');

function signature(body, secret) {
    return createHmac('sha256', secret).update(body).digest('base64url');
}

export function createSession(wallet, expiresAt, secret, scope = 'elite') {
    if (!secret) throw new Error('SESSION_SECRET_MISSING');
    const body = encode(JSON.stringify({ wallet, scope, exp: Math.floor(new Date(expiresAt).getTime() / 1000) }));
    return body + '.' + signature(body, secret);
}

/** The wallet a token was issued to, or null when the token is malformed, tampered with or expired. */
export function readSession(token, secret, now = Date.now()) {
    if (!secret || typeof token !== 'string') return null;
    const [body, sig] = token.split('.');
    if (!body || !sig) return null;
    const expected = Buffer.from(signature(body, secret));
    const given = Buffer.from(sig);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
        const { wallet, exp, scope = 'elite' } = JSON.parse(Buffer.from(body, 'base64url').toString());
        if (typeof wallet !== 'string' || !Number.isFinite(exp) || exp * 1000 <= now) return null;
        return { wallet, scope, expiresAt: new Date(exp * 1000) };
    } catch {
        return null;
    }
}
