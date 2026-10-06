import test from 'node:test';
import assert from 'node:assert/strict';
import { findIncomingTransfer, findFunder, linkHolders, HISTORY_LIMIT } from '../src/lib/scan/funding.mjs';
const tx = (instructions, inner = []) => ({ transaction: { message: { instructions } }, meta: { innerInstructions: [{ instructions: inner }] } });
const transfer = (source, destination) => ({ program: 'system', parsed: { type: 'transfer', info: { source, destination, lamports: 5 } } });
test('finds the transfer that funded a wallet, including inner instructions and account creation', () => {
 assert.deepEqual(findIncomingTransfer(tx([transfer('a', 'w')]), 'w'), { source: 'a', lamports: 5 });
 assert.deepEqual(findIncomingTransfer(tx([], [transfer('b', 'w')]), 'w'), { source: 'b', lamports: 5 });
 assert.deepEqual(findIncomingTransfer(tx([{ program: 'system', parsed: { type: 'createAccount', info: { source: 'c', newAccount: 'w', lamports: 9 } } }]), 'w'), { source: 'c', lamports: 9 });
 assert.equal(findIncomingTransfer(tx([transfer('w', 'x')]), 'w'), null);
 assert.equal(findIncomingTransfer(null, 'w'), null);
});
test('reads the funder from the oldest transaction, and skips long-lived wallets', async () => {
 const wallet = '11111111111111111111111111111111';
 const connection = n => ({
  getSignaturesForAddress: async () => Array.from({ length: n }, (_, i) => ({ signature: 'sig' + i })),
  getParsedTransaction: async signature => (signature === 'sig' + (n - 1) ? tx([transfer('funder', wallet)]) : null),
 });
 assert.deepEqual(await findFunder(connection(3), wallet), { status: 'found', funder: 'funder', signature: 'sig2' });
 assert.deepEqual(await findFunder(connection(HISTORY_LIMIT), wallet), { status: 'established' });
 assert.deepEqual(await findFunder(connection(0), wallet), { status: 'empty' });
});
test('links holders that share a funder or were funded by the creator', () => {
 const found = funder => ({ status: 'found', funder });
 const result = linkHolders([
  { owner: 'a', percent: 5, funding: found('f1') },
  { owner: 'b', percent: 4, funding: found('f1') },
  { owner: 'c', percent: 3, funding: found('dev') },
  { owner: 'd', percent: 2, funding: found('f2') },
  { owner: 'e', percent: 1, funding: { status: 'established' } },
 ], 'dev');
 assert.deepEqual(result.linked, [
  { funder: 'f1', fundedByCreator: false, wallets: ['a', 'b'], percent: 9 },
  { funder: 'dev', fundedByCreator: true, wallets: ['c'], percent: 3 },
 ]);
 assert.equal(result.linkedPercent, 12);
});
