import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, readSession } from '../src/lib/server/session.mjs';
const secret = 'test-secret';
const later = new Date(Date.now() + 3_600_000);
test('a session token round-trips the wallet', () => {
 const token = createSession('wallet1', later, secret);
 assert.equal(readSession(token, secret)?.wallet, 'wallet1');
});
test('rejects tampered, foreign, expired and malformed tokens', () => {
 const token = createSession('wallet1', later, secret);
 const [, sig] = token.split('.');
 const forged = Buffer.from(JSON.stringify({ wallet: 'attacker', exp: Math.floor(later.getTime() / 1000) })).toString('base64url') + '.' + sig;
 assert.equal(readSession(forged, secret), null);
 assert.equal(readSession(token, 'other-secret'), null);
 assert.equal(readSession(createSession('wallet1', new Date(Date.now() - 1000), secret), secret), null);
 for (const bad of ['', 'abc', 'a.b.c', null, undefined]) assert.equal(readSession(bad, secret), null);
});
test('carries a scope, defaulting to elite', () => {
 assert.equal(readSession(createSession('w', later, secret), secret)?.scope, 'elite');
 assert.equal(readSession(createSession('w', later, secret, 'admin'), secret)?.scope, 'admin');
});
test('refuses to issue a token without a secret', () => {
 assert.throws(() => createSession('wallet1', later, ''), /SESSION_SECRET_MISSING/);
});
