import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS, formatUsd, usdToLamports } from '../src/lib/payments/pricing.mjs';
import { canEditProfile, extendExpiry, isBoostActive, publicProfile } from '../src/lib/profiles.mjs';
const now = new Date('2026-10-05T12:00:00Z');
const hour = 3_600_000;
test('converts USD prices to lamports, rounded up to 0.00001 SOL', () => {
 assert.equal(usdToLamports(2900, 120), 241_670_000);
 assert.equal(usdToLamports(500, 100), 50_000_000);
 assert.equal(usdToLamports(PRODUCTS.Boost.usdCents, 120.31) % 10_000, 0);
});
test('refuses implausible SOL prices and bad amounts', () => {
 for (const price of [0, -1, NaN, 2, 50_000]) assert.throws(() => usdToLamports(2900, price), /SOL_PRICE_UNAVAILABLE/);
 assert.throws(() => usdToLamports(0, 120), /INVALID_PRICE/);
 assert.throws(() => usdToLamports(29.5, 120), /INVALID_PRICE/);
});
test('formats USD prices', () => {
 assert.equal(formatUsd(2900), '$29');
 assert.equal(formatUsd(550), '$5.50');
});
test('only paid profiles may edit their identity', () => {
 assert.equal(canEditProfile('Basic'), false);
 assert.equal(canEditProfile(undefined), false);
 assert.equal(canEditProfile('Enhanced'), true);
 assert.equal(canEditProfile('Elite'), true);
});
test('renewing a boost stacks on the remaining time', () => {
 assert.equal(extendExpiry(null, 24 * hour, now).toISOString(), '2026-10-06T12:00:00.000Z');
 assert.equal(extendExpiry(new Date(now.getTime() + 5 * hour), 24 * hour, now).toISOString(), '2026-10-06T17:00:00.000Z');
 assert.equal(extendExpiry(new Date(now.getTime() - 5 * hour), 24 * hour, now).toISOString(), '2026-10-06T12:00:00.000Z');
});
test('a boost is active only until it expires', () => {
 assert.equal(isBoostActive({ boostExpiresAt: new Date(now.getTime() + 1) }, now), true);
 assert.equal(isBoostActive({ boostExpiresAt: now }, now), false);
 assert.equal(isBoostActive({}, now), false);
});
test('an unpaid claim shows no project-supplied images, links or text', () => {
 const stored = { address: 'mint', tier: 'Basic', owner: 'dev', bannerURI: 'https://evil.example/b.png', iconURI: 'https://evil.example/i.png', socials: '{"website":"https://evil.example"}', customDescription: 'Buy now' };
 const shown = publicProfile(stored, now);
 assert.equal(shown.bannerURI, null);
 assert.equal(shown.iconURI, null);
 assert.deepEqual(shown.socials, {});
 assert.equal(shown.customDescription, null);
 const paid = publicProfile({ ...stored, tier: 'Enhanced' }, now);
 assert.equal(paid.bannerURI, stored.bannerURI);
 assert.equal(paid.socials.website, 'https://evil.example');
});
test('public profiles drop non-https links and map the legacy Elite tier', () => {
 const shown = publicProfile({ address: 'mint', tier: 'Elite', socials: '{"twitter":"javascript:alert(1)","telegram":"https://t.me/x"}' }, now);
 assert.equal(shown.tier, 'Enhanced');
 assert.equal(shown.socials.twitter, undefined);
 assert.equal(shown.socials.telegram, 'https://t.me/x');
});
