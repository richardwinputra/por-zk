import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pedersenHash, destroyBb } from '../pedersen.js';

test('h_W matches Noir reference for [10,20,30,40,50]M cents witness', async () => {
  const cents = 100_000_000n;
  const wf: bigint[] = new Array(30).fill(0n);
  const balances = [10n, 20n, 30n, 40n, 50n];
  for (let i = 0; i < 5; i++) wf[3 * i] = balances[i] * cents;
  const h = await pedersenHash(wf);
  assert.equal('0x' + h.toString(16).padStart(64, '0'),
    '0x035ec33d4704cc84a0c73f02279a2fff70de5147adf1f3e3a4cf96e883f7e3c3');
});

test.after(async () => { await destroyBb(); });
