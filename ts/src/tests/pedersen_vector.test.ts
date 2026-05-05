import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pedersenHash, destroyBb } from '../pedersen.js';

test('pedersen_hash([1,2,3]) matches Noir reference vector', async () => {
  const h = await pedersenHash([1n, 2n, 3n]);
  assert.equal('0x' + h.toString(16).padStart(64, '0'),
    '0x0c21b8e26f60b476d9568df4807131ff70d8b7fffb03fa07960aa1cac9be7c46');
});

test('pedersen_hash([1..5]) matches Noir reference vector', async () => {
  const h = await pedersenHash([1n, 2n, 3n, 4n, 5n]);
  assert.equal('0x' + h.toString(16).padStart(64, '0'),
    '0x0f193c60b69e42b3cb5d8a35db01a7bc0b6cf8e98a96665ca4b8af665b835259');
});

test.after(async () => { await destroyBb(); });
