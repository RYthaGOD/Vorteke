import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, PublicKey } from '@solana/web3.js';
import { METAPLEX_METADATA_PROGRAM, PUMP_PROGRAM, parseMetaplexUpdateAuthority, parsePumpCreator, primaryCreator, pumpBondingCurveAddress, resolveProjectAuthorities } from '../src/lib/solana/creator.mjs';
const wallet = n => Keypair.fromSeed(new Uint8Array(32).fill(n)).publicKey;
const mint = wallet(9);
const curveData = creator => { const data = Buffer.alloc(151); creator.toBuffer().copy(data, 49); return data; };
const metadataData = authority => { const data = Buffer.alloc(100); data[0] = 4; authority.toBuffer().copy(data, 1); return data; };
const mintAccount = (info, owner = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') => ({ value: { owner: new PublicKey(owner), data: { parsed: { type: 'mint', info } } } });
const connection = (info, curve, metadata) => ({
 getParsedAccountInfo: async () => info,
 getMultipleAccountsInfo: async () => [curve ?? null, metadata ?? null],
});
test('derives the same bonding-curve address Pump.fun uses on mainnet', () => {
 assert.equal(pumpBondingCurveAddress('GTBxUiw6wJdmmkCGZgRHLyYxqu1vG4KtRpeox6yDpump').toBase58(), '9JGQ767qGY9ya2PpuXgDMiQL8YNYH3Jms2fyhrBPXsg5');
});
test('reads the creator from a bonding curve and ignores old short curves', () => {
 assert.equal(parsePumpCreator(curveData(wallet(1))), wallet(1).toBase58());
 assert.equal(parsePumpCreator(Buffer.alloc(49)), null);
 assert.equal(parsePumpCreator(Buffer.alloc(151)), null);
});
test('reads the Metaplex update authority', () => {
 assert.equal(parseMetaplexUpdateAuthority(metadataData(wallet(2))), wallet(2).toBase58());
 assert.equal(parseMetaplexUpdateAuthority(Buffer.alloc(10)), null);
});
test('a Pump.fun token is claimable by its curve creator, not the launchpad metadata authority', async () => {
 const found = await resolveProjectAuthorities(connection(mintAccount({ mintAuthority: null }),
  { owner: new PublicKey(PUMP_PROGRAM), data: curveData(wallet(1)) },
  { owner: new PublicKey(METAPLEX_METADATA_PROGRAM), data: metadataData(wallet(3)) }), mint);
 assert.deepEqual(found, [{ wallet: wallet(1).toBase58(), source: 'pump-creator' }]);
 assert.equal(primaryCreator(found), wallet(1).toBase58());
});
test('other tokens accept the mint authority and metadata authorities', async () => {
 const found = await resolveProjectAuthorities(connection(mintAccount({ mintAuthority: wallet(4).toBase58(), extensions: [{ extension: 'tokenMetadata', state: { updateAuthority: wallet(5).toBase58() } }] }),
  null, { owner: new PublicKey(METAPLEX_METADATA_PROGRAM), data: metadataData(wallet(4)) }), mint);
 assert.deepEqual(found.map(f => f.wallet), [wallet(4).toBase58(), wallet(5).toBase58()]);
});
test('ignores curve or metadata accounts owned by another program, and non-mint accounts', async () => {
 const spoofed = await resolveProjectAuthorities(connection(mintAccount({ mintAuthority: null }),
  { owner: wallet(7), data: curveData(wallet(1)) }, { owner: wallet(7), data: metadataData(wallet(2)) }), mint);
 assert.deepEqual(spoofed, []);
 const notMint = await resolveProjectAuthorities(connection({ value: { data: { parsed: { type: 'account', info: {} } } } }), mint);
 assert.deepEqual(notMint, []);
});
