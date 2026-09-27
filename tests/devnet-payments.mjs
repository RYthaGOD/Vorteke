// Explicitly opt into devnet only. Never loads a mainnet wallet or RPC configuration.
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
assert.ok(await connection.getBalance(payer.publicKey) > 600000000, 'Fund test wallet with at least 0.6 devnet SOL');
async function post(path, body) {
    const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: res.status, body: await res.json() };
}
const address = (await createMint(connection, payer, payer.publicKey, null, 9)).toBase58();
const wallet = payer.publicKey.toBase58();
const timestamp = Date.now();
const signature = bs58.encode(nacl.sign.detached(new TextEncoder().encode(`VORTEX_CLAIM::${address}::${wallet}::${timestamp}`), payer.secretKey));
assert.equal((await post('/api/claim', { wallet, address, timestamp, signature })).status, 200, 'Creator can claim profile');
console.log('PASS creator claim', address);
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
const prepared = await prepare('Enhanced', { amount: 1 });
assert.equal(prepared.body.lamports, 200000000, 'Server ignores client price');
const first = await send(prepared);
assert.equal((await verify(first)).status, 200, 'Valid payment activates upgrade');
assert.equal((await verify(first)).status, 200, 'Retry is idempotent');
assert.equal((await verify(first, 'Elite')).status, 409, 'Cannot reuse receipt for another tier');
assert.equal((await verify(first, 'Enhanced', { address: Keypair.generate().publicKey.toBase58() })).status, 409, 'Cannot reuse receipt for another profile');
assert.equal((await verify(first, 'Enhanced', { wallet: Keypair.generate().publicKey.toBase58() })).status, 409, 'Cannot reuse receipt for another wallet');
console.log('PASS exact payment, server pricing, retries, cross-tier/profile/wallet rejection', first);
const second = await send(await prepare('Enhanced'));
assert.equal((await verify(second)).status, 200);
assert.equal((await verify(first)).status, 200, 'Old receipt retained after a newer payment');
assert.equal((await verify(first, 'DeepScan')).status, 409, 'Old receipt cannot buy scan');
const wrongAmount = await send(await prepare('Enhanced'), true);
assert.equal((await verify(wrongAmount)).body.error, 'INCORRECT_PAYMENT_AMOUNT');
console.log('PASS permanent receipt history and underpayment rejection');
const scan = await send(await prepare('DeepScan'));
assert.equal((await verify(scan, 'DeepScan')).status, 200);
assert.equal((await verify(scan, 'Elite')).status, 409);
const outsider = Keypair.generate().publicKey.toBase58();
assert.equal((await prepare('Elite', { wallet: outsider })).status, 403, 'Another wallet cannot buy ownership');
const profile = await fetch(base + '/api/enhancement/' + address).then(r => r.json());
assert.equal(profile.owner, wallet);
console.log('PASS scan receipt isolation and owner preservation');
console.log('DEVNET SUITE PASSED', JSON.stringify({ address, wallet, first, second, scan }));
