import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeypair, signMessage, verifyMessage } from '../schnorr.js';
import { pedersenHash, destroyBb } from '../pedersen.js';

test('schnorr roundtrip on Pedersen-derived message verifies', async () => {
  const k = await generateKeypair(0xabcdn);
  const msg = await pedersenHash([1n, 2n, 3n]);
  const sig = await signMessage(k.sk, msg);
  assert.equal(sig.length, 64);
  const ok = await verifyMessage(k.pkX, k.pkY, msg, sig);
  assert.equal(ok, true);
});

test('schnorr rejects wrong message', async () => {
  const k = await generateKeypair(0xabcdn);
  const msg = await pedersenHash([1n, 2n, 3n]);
  const wrongMsg = await pedersenHash([1n, 2n, 4n]);
  const sig = await signMessage(k.sk, msg);
  const ok = await verifyMessage(k.pkX, k.pkY, wrongMsg, sig);
  assert.equal(ok, false);
});

test.after(async () => { await destroyBb(); });
