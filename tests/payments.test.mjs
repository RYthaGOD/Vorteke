import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePayment, MEMO_PROGRAM } from '../src/lib/payments/validate.mjs';
const intent = { id: 'intent-1', wallet: 'payer', lamports: 200000000, createdAt: new Date(100000), expiresAt: new Date(200000) };
function transaction() { return { meta: { err: null }, blockTime: 150, transaction: { message: {
    accountKeys: [{ pubkey: 'payer', signer: true }], instructions: [
        { programId: '11111111111111111111111111111111', parsed: { type: 'transfer', info: { source: 'payer', destination: 'treasury', lamports: intent.lamports } } },
        { programId: MEMO_PROGRAM, parsed: 'VORTEX_PAY:intent-1' },
    ],
} } }; }
test('accepts exact signed payment bound to intent', () => assert.equal(validatePayment(transaction(), intent, 'treasury'), null));
test('rejects underpayment', () => { const tx = transaction(); tx.transaction.message.instructions[0].parsed.info.lamports--; assert.equal(validatePayment(tx, intent, 'treasury'), 'INCORRECT_PAYMENT_AMOUNT'); });
test('rejects non-signer payer', () => { const tx = transaction(); tx.transaction.message.accountKeys[0].signer = false; assert.equal(validatePayment(tx, intent, 'treasury'), 'INVALID_PAYER'); });
test('rejects another purchase reference', () => { const tx = transaction(); tx.transaction.message.instructions[1].parsed += '-other'; assert.equal(validatePayment(tx, intent, 'treasury'), 'INVALID_PAYMENT_REFERENCE'); });
test('rejects failed transactions', () => { const tx = transaction(); tx.meta.err = 'failed'; assert.equal(validatePayment(tx, intent, 'treasury'), 'TRANSACTION_FAILED'); });
test('rejects expired payments', () => { const tx = transaction(); tx.blockTime = 201; assert.equal(validatePayment(tx, intent, 'treasury'), 'PAYMENT_EXPIRED'); });
test('rejects another sender', () => { const tx = transaction(); tx.transaction.message.instructions[0].parsed.info.source = 'other'; assert.equal(validatePayment(tx, intent, 'treasury'), 'INCORRECT_PAYMENT_AMOUNT'); });
test('rejects another treasury', () => assert.equal(validatePayment(transaction(), intent, 'other'), 'INCORRECT_PAYMENT_AMOUNT'));
