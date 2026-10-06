import test from 'node:test';
import assert from 'node:assert/strict';
import { PublicKey } from '@solana/web3.js';
import { JITO_TIP_ACCOUNTS, randomTipAccount } from '../src/lib/solana/jito.mjs';
// Addresses shipped before October 2026 that are not Jito tip accounts; tips sent there were lost.
const WRONG = ['96g9sAg9u3mBsJqcRepo4m9637jg7BSM7zXv8Uf8SdfS', 'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gM8', 'Cw8CFFL1T49q9895AB6Yv8sUygM96shKthshLdK8T7n6'];
test('tip accounts are the eight official Jito accounts', () => {
 assert.equal(JITO_TIP_ACCOUNTS.length, 8);
 assert.equal(new Set(JITO_TIP_ACCOUNTS).size, 8);
 for (const account of JITO_TIP_ACCOUNTS) assert.doesNotThrow(() => new PublicKey(account));
 for (const wrong of WRONG) assert.ok(!JITO_TIP_ACCOUNTS.includes(wrong), wrong);
});
test('a random tip account always comes from the list', () => {
 for (let i = 0; i < 50; i++) assert.ok(JITO_TIP_ACCOUNTS.includes(randomTipAccount()));
});
test('matches the live Jito list when JITO_LIVE_CHECK=1', { skip: process.env.JITO_LIVE_CHECK !== '1' }, async () => {
 const response = await fetch('https://mainnet.block-engine.jito.wtf/api/v1/bundles', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTipAccounts', params: [] }),
 });
 const { result } = await response.json();
 assert.deepEqual([...result].sort(), [...JITO_TIP_ACCOUNTS].sort());
});
