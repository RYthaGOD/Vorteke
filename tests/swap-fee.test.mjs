import test from 'node:test';
import assert from 'node:assert/strict';
import { Keypair, SystemProgram, SystemInstruction, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
import { prepareSwapTransaction } from '../src/lib/solana/swapTransaction.mjs';
const payer = Keypair.fromSeed(new Uint8Array(32).fill(1)).publicKey;
const recipient = Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey;
const treasury = Keypair.fromSeed(new Uint8Array(32).fill(3)).publicKey;
const original = () => new VersionedTransaction(new TransactionMessage({ payerKey: payer, recentBlockhash: '11111111111111111111111111111111', instructions: [SystemProgram.transfer({ fromPubkey: payer, toPubkey: recipient, lamports: 1000 })] }).compileToV0Message());
test('adds exactly the disclosed flat fee atomically without signing', () => {
 const result = prepareSwapTransaction(original(), payer, [], { treasury: treasury.toBase58(), feeLamports: 7500000 });
 const roundtrip = VersionedTransaction.deserialize(result.serialize());
 const instructions = TransactionMessage.decompile(roundtrip.message).instructions.map(instruction => SystemInstruction.decodeTransfer(instruction));
 assert.equal(instructions.length, 2);
 assert.equal(instructions[0].lamports, 1000n);
 assert.equal(instructions[1].lamports, 7500000n);
 assert.ok(instructions[1].fromPubkey.equals(payer));
 assert.ok(instructions[1].toPubkey.equals(treasury));
 assert.ok(roundtrip.signatures[0].every(byte => byte === 0));
});
test('preserves the existing Elite fee waiver', () => {
 const result = prepareSwapTransaction(original(), payer, [], { treasury: treasury.toBase58(), feeLamports: 0 });
 assert.equal(TransactionMessage.decompile(result.message).instructions.length, 1);
});
test('rejects a payer mismatch and invalid fee values', () => {
 assert.throws(() => prepareSwapTransaction(original(), recipient, [], { treasury: treasury.toBase58(), feeLamports: 7500000 }), /payer/);
 assert.throws(() => prepareSwapTransaction(original(), payer, [], { treasury: treasury.toBase58(), feeLamports: -1 }), /fee/);
 assert.throws(() => prepareSwapTransaction(original(), payer, [], { treasury: treasury.toBase58(), feeLamports: NaN }), /fee/);
});
test('includes the explicitly selected priority tip separately from the flat fee', () => {
 const result = prepareSwapTransaction(original(), payer, [], { treasury: treasury.toBase58(), feeLamports: 7500000, tip: { address: recipient.toBase58(), lamports: 100000 } });
 const transfers = TransactionMessage.decompile(result.message).instructions.map(instruction => SystemInstruction.decodeTransfer(instruction));
 assert.equal(transfers.length, 3);
 assert.equal(transfers[2].lamports, 100000n);
});
