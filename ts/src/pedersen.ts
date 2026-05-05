import { Barretenberg, Fr } from '@aztec/bb.js';

let bbInstance: Barretenberg | null = null;
let initPromise: Promise<Barretenberg> | null = null;

export async function getBb(): Promise<Barretenberg> {
  if (bbInstance) return bbInstance;
  if (!initPromise) initPromise = Barretenberg.new({});
  bbInstance = await initPromise;
  return bbInstance;
}

export async function destroyBb(): Promise<void> {
  if (bbInstance) {
    await bbInstance.destroy();
    bbInstance = null;
    initPromise = null;
  }
}

export function toFr(value: bigint): Fr {
  if (value < 0n) throw new Error(`negative value not allowed: ${value}`);
  return new Fr(value);
}

export function frToHex(fr: Fr): string {
  return fr.toString();
}

export function frToBigInt(fr: Fr): bigint {
  return BigInt(fr.toString());
}

export async function pedersenHash(values: bigint[]): Promise<bigint> {
  const bb = await getBb();
  const out = await bb.pedersenHash(values.map(toFr), 0);
  return frToBigInt(out);
}
