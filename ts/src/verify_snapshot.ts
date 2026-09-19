import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { bbVerify } from './runner.js';
import { encodePolicyJson } from './policy_hash.js';

export interface TrustedSnapshot {
  // Authenticated verifier configuration/registry data, NEVER supplied by the proof sender.
  snapshotId: string;
  policyVersion: bigint;
  policyDigest: bigint;
  supply: bigint;
  auditorPkX: bigint;
  auditorPkY: bigint;
  verificationKeySha256: string;
  validFrom: string;
  validUntil: string;
}
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
// Pinned bb v0.82.2: u32 BE count followed by 32-byte fields (bb.js splitHonkProof).
// The first four fields are this circuit's application public inputs. The approved VK fixes this layout.
export function readPublicInputs(proof: Buffer): bigint[] {
  if (proof.length < 132 || proof.readUInt32BE(0) * 32 + 4 !== proof.length) throw new Error('Malformed native proof');
  return Array.from({ length: 4 }, (_, i) => BigInt('0x' + proof.subarray(4 + i * 32, 36 + i * 32).toString('hex')));
}
export function isCryptographicRejection(result: { ok: boolean; stdout: string; stderr: string }): boolean {
  return !result.ok && /Proof verification failed/.test(result.stdout + result.stderr);
}
export async function verifyForSnapshot(proofPath: string, vkPath: string, policyPath: string, expected: TrustedSnapshot, now = Date.now()) {
  const reject = (reason: string) => ({ accepted: false, reason });
  const from = Date.parse(expected.validFrom), until = Date.parse(expected.validUntil);
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) return reject('invalid_validity_window');
  if (now < from || now >= until) return reject('snapshot_not_current');
  const [proof, vk] = await Promise.all([fs.readFile(proofPath), fs.readFile(vkPath)]);
  if (sha256(vk) !== expected.verificationKeySha256) return reject('unapproved_verification_key');
  if (await encodePolicyJson(policyPath) !== expected.policyVersion) return reject('policy_document_mismatch');
  let inputs: bigint[];
  try { inputs = readPublicInputs(proof); } catch { return reject('malformed_proof'); }
  if (inputs[0] !== expected.supply) return reject('supply_mismatch');
  if (inputs[1] !== expected.policyDigest) return reject('snapshot_digest_mismatch');
  if (inputs[2] !== expected.auditorPkX || inputs[3] !== expected.auditorPkY) return reject('unapproved_auditor');
  // Verify the exact bytes inspected above, even if caller-provided file paths change.
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'por-verify-'));
  try {
    await fs.writeFile(path.join(staging, 'proof'), proof, { mode: 0o600 });
    await fs.writeFile(path.join(staging, 'vk'), vk, { mode: 0o600 });
    const result = await bbVerify(staging, 'proof', 'vk');
    if (result.ok) return { accepted: true, reason: 'accepted' };
    if (isCryptographicRejection(result)) return reject('invalid_proof');
    throw new Error(`Verifier operational failure: ${result.stdout}\n${result.stderr}`);
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
}
