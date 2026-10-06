import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeHolders } from '../src/lib/scan/holders.mjs';
const holder = (owner, amountRaw, onCurve = true) => ({ owner, amountRaw, onCurve });
test('pools and curves are listed but not counted as wallet concentration', () => {
 const summary = summarizeHolders({ supplyRaw: '1000000', holders: [holder('pool', '600000', false), holder('a', '100000'), holder('b', '50000')] });
 assert.equal(summary.top10WalletPercent, 15);
 assert.equal(summary.programPercent, 60);
 assert.equal(summary.riskLevel, 'LOW');
 assert.deepEqual(summary.holders.map(h => h.kind), ['program', 'wallet', 'wallet']);
});
test('several accounts of one owner are combined', () => {
 const summary = summarizeHolders({ supplyRaw: '1000', holders: [holder('a', '300'), holder('b', '400'), holder('a', '200')] });
 assert.deepEqual(summary.holders.map(h => [h.owner, h.percent]), [['a', 50], ['b', 40]]);
 assert.equal(summary.top10WalletPercent, 90);
 assert.equal(summary.riskLevel, 'HIGH');
});
test('marks the creator and burned supply', () => {
 const summary = summarizeHolders({ supplyRaw: '1000', creatorWallets: ['dev'], holders: [holder('1nc1nerator11111111111111111111111111111111', '100', false), holder('dev', '55')] });
 assert.equal(summary.burnedPercent, 10);
 assert.equal(summary.creatorPercent, 5.5);
 assert.equal(summary.holders.find(h => h.owner === 'dev').isCreator, true);
});
test('handles supplies beyond the safe integer range and an empty supply', () => {
 const big = summarizeHolders({ supplyRaw: '1000000000000000000000', holders: [holder('a', '250000000000000000000')] });
 assert.equal(big.top10WalletPercent, 25);
 assert.equal(summarizeHolders({ supplyRaw: '0', holders: [holder('a', '0')] }).top10WalletPercent, 0);
});
