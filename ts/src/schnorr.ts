import { Fr } from '@aztec/bb.js';
import { promises as fs } from 'node:fs';
import { getBb, frToBigInt, toFr } from './pedersen.js';

export interface AuditorKey {
  sk: bigint;
  pkX: bigint;
  pkY: bigint;
}

export async function generateKeypair(seed?: bigint): Promise<AuditorKey> {
  const bb = await getBb();
  const sk = seed !== undefined ? toFr(seed) : Fr.random();
  const pk = await bb.schnorrComputePublicKey(sk);
  return { sk: BigInt(sk.toString()), pkX: frToBigInt(pk.x), pkY: frToBigInt(pk.y) };
}

export async function loadOrCreateAuditorKey(path: string, seed = 0xabcdn): Promise<AuditorKey> {
  try {
    const buf = await fs.readFile(path, 'utf8');
    const j = JSON.parse(buf);
    return { sk: BigInt(j.sk), pkX: BigInt(j.pkX), pkY: BigInt(j.pkY) };
  } catch {
    const k = await generateKeypair(seed);
    await fs.writeFile(path, JSON.stringify({
      sk: '0x' + k.sk.toString(16),
      pkX: '0x' + k.pkX.toString(16),
      pkY: '0x' + k.pkY.toString(16),
    }, null, 2));
    return k;
  }
}

export function fieldToBeBytes32(value: bigint): Uint8Array {
  if (value < 0n) throw new Error('negative');
  const out = new Uint8Array(32);
  let v = value;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  if (v !== 0n) throw new Error(`value > 256 bits: ${value}`);
  return out;
}

class PointLike {
  constructor(public x: Fr, public y: Fr) {}
  toBuffer(): Uint8Array {
    const out = new Uint8Array(64);
    out.set(this.x.toBuffer(), 0);
    out.set(this.y.toBuffer(), 32);
    return out;
  }
}

class Buffer32Like {
  constructor(public buffer: Uint8Array) {
    if (buffer.length !== 32) throw new Error(`expected 32 bytes, got ${buffer.length}`);
  }
  toBuffer(): Uint8Array { return this.buffer; }
}

export async function signMessage(sk: bigint, message: bigint): Promise<Uint8Array> {
  const bb = await getBb();
  const msgBytes = fieldToBeBytes32(message);
  const [s, e] = await bb.schnorrConstructSignature(msgBytes, toFr(sk));
  const sig = new Uint8Array(64);
  sig.set(s.toBuffer(), 0);
  sig.set(e.toBuffer(), 32);
  return sig;
}

export async function verifyMessage(pkX: bigint, pkY: bigint, message: bigint, sig64: Uint8Array): Promise<boolean> {
  const bb = await getBb();
  const msgBytes = fieldToBeBytes32(message);
  const pk = new PointLike(toFr(pkX), toFr(pkY));
  const sBuf = new Buffer32Like(sig64.slice(0, 32));
  const eBuf = new Buffer32Like(sig64.slice(32, 64));
  return await bb.schnorrVerifySignature(msgBytes, pk as any, sBuf as any, eBuf as any);
}
