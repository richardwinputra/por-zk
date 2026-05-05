import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pedersenHash, destroyBb } from '../pedersen.js';

test('h_P matches Noir reference vector', async () => {
  const cents = 100_000_000n;
  const fields: bigint[] = [
    0xc0ffeen,           // policy_version
    20230306n,           // snapshot_id
    100n * cents,        // supply
    1n, 1n, 1n, 1n, 1n, 0n, 0n, 0n, 0n, 0n, // eligibility[0..10]
    0xbeefn,             // policy_salt
  ];
  const h = await pedersenHash(fields);
  assert.equal('0x' + h.toString(16).padStart(64, '0'),
    '0x0c6fe6d9d60eb5e411eb1dce6845672d45151d2ce6d79a2630597180254cd255');
});

test('h_P changes when policy_version changes', async () => {
  const cents = 100_000_000n;
  const base = (pv: bigint) => [
    pv, 20230306n, 100n * cents,
    1n,1n,1n,1n,1n,0n,0n,0n,0n,0n,
    0xbeefn,
  ];
  const a = await pedersenHash(base(0xc0ffeen));
  const b = await pedersenHash(base(0xc0ff00n));
  assert.notEqual(a.toString(16), b.toString(16));
});

test.after(async () => { await destroyBb(); });
