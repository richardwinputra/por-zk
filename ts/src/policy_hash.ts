import { promises as fs } from 'node:fs';
import { pedersenHash } from './pedersen.js';

export function jcsCanonicalize(value: unknown): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-finite number');
    if (Number.isInteger(value)) return value.toString();
    return value.toString();
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(jcsCanonicalize).join(',') + ']';
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const parts = keys.map(k => JSON.stringify(k) + ':' + jcsCanonicalize((value as any)[k]));
    return '{' + parts.join(',') + '}';
  }
  throw new Error(`unsupported value: ${typeof value}`);
}

export function chunkBytesToFields(bytes: Uint8Array, chunkSize = 31): bigint[] {
  const fields: bigint[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    const chunk = bytes.slice(i, end);
    const padded = new Uint8Array(chunkSize);
    padded.set(chunk, 0);
    let v = 0n;
    for (let j = chunkSize - 1; j >= 0; j--) {
      v = (v << 8n) | BigInt(padded[j]);
    }
    fields.push(v);
  }
  if (fields.length === 0) fields.push(0n);
  return fields;
}

export async function encodePolicyJson(path: string): Promise<bigint> {
  const raw = await fs.readFile(path, 'utf8');
  const parsed = JSON.parse(raw);
  const canonical = jcsCanonicalize(parsed);
  const bytes = new TextEncoder().encode(canonical);
  const fields = chunkBytesToFields(bytes, 31);
  return await pedersenHash(fields);
}
