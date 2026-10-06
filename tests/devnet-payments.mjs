// Explicitly opt into devnet only. Never loads a mainnet wallet or RPC configuration.
// Run against a local server started with NEXT_PUBLIC_SOLANA_NETWORK=devnet:
//   TEST_BASE_URL=http://localhost:3199 node tests/devnet-payments.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Connection, Keypair, Transaction, SystemProgram, PublicKey } from '@solana/web3.js';
import { createMint } from '@solana/spl-token';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const base = process.env.TEST_BASE_URL || 'http://localhost:3199';
assert.ok(new URL(base).hostname === 'localhost', 'Use an isolated localhost test server');
const config = await fetch(base + '/api/pay/config').then(r => r.json());
assert.equal(config.network, 'devnet', 'Refusing to test payments against a non-devnet server');
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
const payer = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(new URL('../.scratch/devnet-test-keypair.json', import.meta.url), 'utf8'))));
assert.ok(await connection.getBalance(payer.publicKey) > 1_000_000_000, 'Fund test wallet with at least 1 devnet SOL');
const HOUR = 3_600_000;
const near = (iso, ms, slack = 5 * 60_000) => Math.abs(new Date(iso).getTime() - (Date.now() + ms)) < slack;

async function post(path, body, method = 'POST') {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
}
const sign = (message, keypair = payer) => bs58.encode(nacl.sign.detached(new TextEncoder().encode(message), keypair.secretKey));
const wallet = payer.publicKey.toBase58();

// Claims: only a wallet that controls the token on chain may claim it.
const stranger = Keypair.generate();
const foreignMint = (await createMint(connection, payer, stranger.publicKey, null, 9)).toBase58();
let timestamp = Date.now();
assert.equal((await post('/api/claim', { wallet, address: foreignMint, timestamp, signature: sign(`VORTEX_CLAIM::${foreignMint}::${wallet}::${timestamp}`) })).status, 403, 'A non-creator cannot claim');
const address = (await createMint(connection, payer, payer.publicKey, null, 9)).toBase58();
timestamp = Date.now();
assert.equal((await post('/api/claim', { wallet, address, timestamp, signature: sign(`VORTEX_CLAIM::${address}::${wallet}::${timestamp}`) })).status, 200, 'The mint authority can claim');
timestamp = Date.now();
assert.equal((await post('/api/claim', { address, wallet, timestamp, signature: sign(`VORTEX_UPDATE::${address}::${wallet}::${timestamp}`), metadata: { bannerURI: 'https://example.com/b.png' } }, 'PATCH')).status, 402, 'A Basic profile cannot set a banner');
console.log('PASS claims', address);

const prepare = (tier, extra = {}) => post('/api/pay/initiate', { wallet, address, tier, ...extra });
async function send(prepared, underpay = false) {
    assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
    const tx = Transaction.from(Buffer.from(prepared.body.transaction, 'base64'));
    if (underpay) tx.instructions[0] = SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: new PublicKey(config.treasury), lamports: 1_000_000 });
    // Compilation/RPC latency must not make an otherwise valid test use an expired blockhash.
    const latest = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = latest.blockhash;
    tx.sign(payer);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({ signature, ...latest }, 'finalized');
    return signature;
}
const verify = (signature, tier = 'Enhanced', extra = {}) => post('/api/pay/verify', { signature, wallet, address, tier, ...extra });

// Enhanced profile.
const prepared = await prepare('Enhanced', { amount: 1 });
assert.equal(prepared.body.usdCents, 2900, 'Server prices in USD and ignores the client amount');
assert.ok(prepared.body.lamports > 1_000_000, 'Server converts USD to lamports');
const first = await send(prepared);
assert.equal((await verify(first)).status, 200, 'Valid payment activates the upgrade');
assert.equal((await verify(first)).status, 200, 'Retry is idempotent');
assert.equal((await verify(first, 'Boost')).status, 409, 'Cannot reuse a receipt for another product');
assert.equal((await verify(first, 'Enhanced', { address: Keypair.generate().publicKey.toBase58() })).status, 409, 'Cannot reuse a receipt for another profile');
assert.equal((await verify(first, 'Enhanced', { wallet: Keypair.generate().publicKey.toBase58() })).status, 409, 'Cannot reuse a receipt for another wallet');
assert.equal((await prepare('Enhanced')).status, 409, 'Cannot buy Enhanced twice');
timestamp = Date.now();
assert.equal((await post('/api/claim', { address, wallet, timestamp, signature: sign(`VORTEX_UPDATE::${address}::${wallet}::${timestamp}`), metadata: { bannerURI: 'https://example.com/b.png' } }, 'PATCH')).status, 200, 'An Enhanced profile can set a banner');
console.log('PASS Enhanced: USD pricing, retries, cross-product/profile/wallet rejection, edits', first);

// Trending boost: each payment adds 24 hours.
const boost1 = await send(await prepare('Boost'));
const b1 = await verify(boost1, 'Boost');
assert.equal(b1.status, 200);
assert.ok(near(b1.body.expiresAt, 24 * HOUR), 'First boost runs 24 hours');
const boost2 = await send(await prepare('Boost'));
const b2 = await verify(boost2, 'Boost');
assert.ok(near(b2.body.expiresAt, 48 * HOUR), 'A renewal stacks another 24 hours');
const wrongAmount = await send(await prepare('Boost'), true);
assert.equal((await verify(wrongAmount, 'Boost')).body.error, 'INCORRECT_PAYMENT_AMOUNT');
const outsider = Keypair.generate().publicKey.toBase58();
assert.equal((await prepare('Boost', { wallet: outsider })).status, 403, 'Another wallet cannot pay for this profile');
const profile = await fetch(base + '/api/enhancement/' + address).then(r => r.json());
assert.equal(profile.owner, wallet);
assert.equal(profile.tier, 'Enhanced');
assert.equal(profile.boosted, true);
assert.equal(profile.bannerURI, 'https://example.com/b.png');
console.log('PASS boosts: 24-hour stacking, underpayment rejection, owner preservation');

// Elite access belongs to the paying wallet.
assert.equal((await post('/api/pay/initiate', { wallet, address, tier: 'EliteAccess' })).status, 400, 'Elite is bought for the paying wallet');
const elite = await send(await post('/api/pay/initiate', { wallet, address: wallet, tier: 'EliteAccess' }));
const e1 = await post('/api/pay/verify', { signature: elite, wallet, address: wallet, tier: 'EliteAccess' });
assert.equal(e1.status, 200);
assert.ok(near(e1.body.expiresAt, 30 * 24 * HOUR), 'Elite runs 30 days');
const check = await fetch(base + '/api/auth/elite-check?wallet=' + wallet).then(r => r.json());
assert.equal(check.isElite, true);
assert.equal(check.source, 'paid');
timestamp = Date.now();
const session = await post('/api/elite/session', { wallet, timestamp, signature: sign(`VORTEX_ELITE_SESSION:${wallet}:${timestamp}`) });
assert.equal(session.status, 200, 'An Elite wallet gets a research session');
console.log('PASS Elite access and research session');
console.log('DEVNET SUITE PASSED', JSON.stringify({ address, wallet, first, boost1, boost2, elite }));
