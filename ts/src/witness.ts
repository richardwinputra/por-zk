import { promises as fs } from 'node:fs';
import { pedersenHash } from './pedersen.js';
import { signMessage, AuditorKey, fieldToBeBytes32 } from './schnorr.js';
import { encodePolicyJson } from './policy_hash.js';
import { CIRCUIT_ID, DOMAIN, N, padArray, Scenario } from './types.js';

export interface BuiltWitness {
  // public
  supply: bigint;
  hP: bigint;
  auditorPkX: bigint;
  auditorPkY: bigint;
  // private
  balances: bigint[];   // length 10, raw values written verbatim into TOML
  holds: bigint[];
  floats: bigint[];
  eligibility: number[]; // 0/1 typically; T6 uses out-of-range
  snapshotId: bigint;
  policyVersion: bigint;
  policySalt: bigint;
  signature: Uint8Array; // 64 bytes
  // bookkeeping
  hW: bigint;
  signedMessage: bigint;
  effectiveTotal: bigint;
}

export async function buildWitness(s: Scenario, auditor: AuditorKey): Promise<BuiltWitness> {
  // 1) Pad slot arrays to 10
  let balances = padArray<bigint>(s.balancesCents, N, 0n);
  let holds = padArray<bigint>(s.holdsCents ?? [], N, 0n);
  let floats = padArray<bigint>(s.floatsCents ?? [], N, 0n);
  let eligibility = padArray<number>(s.eligibility, N, 0);

  // Apply padded slot overrides (e.g. T5)
  if (s.paddedOverride) {
    for (const o of s.paddedOverride) {
      balances[o.idx] = o.balanceCents;
      eligibility[o.idx] = o.eligibility;
    }
  }

  // 2) Compute policy_version from JSON
  const policyVersion = await encodePolicyJson(s.policyJsonPath);
  let policySalt = s.policySalt;
  let supply = s.supplyCents;
  let snapshotId = s.snapshotId;

  // pre-tamper application of underflow_natural (T4): set holds[idx]+floats[idx] > balances[idx]
  if (s.tamper?.kind === 'underflow_natural') {
    const idx = s.tamper.index ?? 0;
    holds[idx] = balances[idx];
    floats[idx] = 1n;
  }
  if (s.tamper?.kind === 'u64_underflow') {
    const idx = s.tamper.index ?? 0;
    balances[idx] = (1n << 64n) - 2n;
    holds[idx] = 1n << 63n;
    floats[idx] = 1n << 63n;
  }

  // 3) Compute h_W
  const witnessFields: bigint[] = [];
  for (let i = 0; i < N; i++) {
    witnessFields.push(balances[i], holds[i], floats[i]);
  }
  const hW = await pedersenHash(witnessFields);

  // 4) Compute h_P over current eligibility
  const policyFields: bigint[] = [
    policyVersion,
    snapshotId,
    supply,
    ...eligibility.map(e => BigInt(e)),
    policySalt,
  ];
  const hP = await pedersenHash(policyFields);

  // 5) Compute m = pedersen([DOMAIN, CIRCUIT_ID, snapshot_id, supply, h_P, h_W])
  const m = await pedersenHash([DOMAIN, CIRCUIT_ID, snapshotId, supply, hP, hW]);

  // 6) Sign m with auditor sk
  let signature = await signMessage(auditor.sk, m);

  // 7) Apply post-sign tampers
  let pkX = auditor.pkX;
  let pkY = auditor.pkY;
  let publicHP = hP;

  if (s.tamper) {
    switch (s.tamper.kind) {
      case 'none':
      case 'underflow_natural':
      case 'u64_underflow':
      case 'boolean_overflow':
        break;
      case 'signature': {
        signature = new Uint8Array(64);
        for (let i = 0; i < 64; i++) signature[i] = (i * 7 + 13) & 0xff;
        break;
      }
      case 'balance': {
        const idx = s.tamper.index ?? 0;
        const delta = s.tamper.delta ?? 10n * 1_000_000n * 100_000_000n; // 10 USDm in cents
        balances[idx] = balances[idx] + delta;
        break;
      }
      case 'auditor_key': {
        // Use a different (valid Grumpkin) public key
        const { generateKeypair } = await import('./schnorr.js');
        const alt = await generateKeypair(0xdeadbeefn);
        pkX = alt.pkX;
        pkY = alt.pkY;
        break;
      }
      case 'snapshot_id': {
        snapshotId = snapshotId + (s.tamper.delta ?? 1n);
        break;
      }
      case 'eligibility': {
        const idx = s.tamper.index ?? 3;
        eligibility[idx] = eligibility[idx] === 0 ? 1 : 0;
        break;
      }
      case 'supply': {
        supply = supply + (s.tamper.delta ?? 1n);
        break;
      }
      case 'policy_salt': {
        policySalt = policySalt + (s.tamper.delta ?? 1n);
        break;
      }
      case 'policy_version': {
        // bump policy_version private input but keep public h_P unchanged
        break;
      }
      case 'stale_snapshot': {
        if (!s.tamper.altPolicyJsonPath) {
          throw new Error('stale_snapshot tamper requires altPolicyJsonPath');
        }
        const altPv = await encodePolicyJson(s.tamper.altPolicyJsonPath);
        // public h_P now corresponds to a different policy_version, but the witness
        // still carries the original policy_version → h_P_computed != h_P
        publicHP = await pedersenHash([
          altPv,
          snapshotId,
          supply,
          ...eligibility.map(e => BigInt(e)),
          policySalt,
        ]);
        break;
      }
    }
    if (s.tamper.kind === 'policy_version') {
      // Need to adjust the policy_version private field after sign; we keep public h_P from the
      // pre-tamper computation, so the in-circuit recomputation will diverge.
      // To do this we have to *change the value we put into Prover.toml* but not what we used for h_P/h_W/m.
      // The simplest way is to encode this by stashing a "tampered" policy version in the BuiltWitness.
      // Here we override policyVersion:
      // (use a deterministic alt value)
      // Note: we leave publicHP alone so the public input still holds the original h_P.
      // policyVersion override happens below
    }
  }

  // For policy_version tamper: override the private policy_version that goes into Prover.toml
  let outPolicyVersion = policyVersion;
  if (s.tamper?.kind === 'policy_version') {
    outPolicyVersion = (policyVersion + 1n);
  }

  // For boolean_overflow (T6): set eligibility[idx] to a value outside {0,1}
  if (s.tamper?.kind === 'boolean_overflow') {
    const idx = s.tamper.index ?? 0;
    eligibility[idx] = Number(s.tamper.value ?? 7n);
  }

  // Compute effective total (off-circuit, for reporting)
  let effective = 0n;
  for (let i = 0; i < N; i++) {
    const b = balances[i];
    const h = holds[i];
    const f = floats[i];
    if (b >= h && (b - h) >= f) {
      effective += (b - h - f) * BigInt(Math.max(0, eligibility[i]));
    }
  }

  return {
    supply,
    hP: publicHP,
    auditorPkX: pkX,
    auditorPkY: pkY,
    balances,
    holds,
    floats,
    eligibility,
    snapshotId,
    policyVersion: outPolicyVersion,
    policySalt,
    signature,
    hW,
    signedMessage: m,
    effectiveTotal: effective,
  };
}

function fieldToToml(v: bigint): string {
  return '"0x' + v.toString(16) + '"';
}

function u64ToToml(v: bigint): string {
  return '"' + v.toString() + '"';
}

function u64ArrayToToml(arr: bigint[]): string {
  return '[' + arr.map(u64ToToml).join(', ') + ']';
}

function u1ArrayToToml(arr: number[]): string {
  return '[' + arr.map(v => '"' + v.toString() + '"').join(', ') + ']';
}

function bytesToToml(arr: Uint8Array): string {
  return '[' + Array.from(arr).map(b => '"' + b.toString() + '"').join(', ') + ']';
}

export async function writeProverToml(path: string, w: BuiltWitness): Promise<void> {
  const lines = [
    `supply = ${u64ToToml(w.supply)}`,
    `h_p = ${fieldToToml(w.hP)}`,
    `auditor_pk_x = ${fieldToToml(w.auditorPkX)}`,
    `auditor_pk_y = ${fieldToToml(w.auditorPkY)}`,
    `balances = ${u64ArrayToToml(w.balances)}`,
    `holds = ${u64ArrayToToml(w.holds)}`,
    `floats = ${u64ArrayToToml(w.floats)}`,
    `eligibility = ${u1ArrayToToml(w.eligibility)}`,
    `snapshot_id = ${u64ToToml(w.snapshotId)}`,
    `policy_version = ${fieldToToml(w.policyVersion)}`,
    `policy_salt = ${fieldToToml(w.policySalt)}`,
    `signature = ${bytesToToml(w.signature)}`,
    '',
  ];
  await fs.writeFile(path, lines.join('\n'));
}

export async function writeBaselineProverToml(path: string, supply: bigint, balances: bigint[], holds: bigint[], floats: bigint[]): Promise<void> {
  const lines = [
    `supply = ${u64ToToml(supply)}`,
    `balances = ${u64ArrayToToml(padArray(balances, N, 0n))}`,
    `holds = ${u64ArrayToToml(padArray(holds, N, 0n))}`,
    `floats = ${u64ArrayToToml(padArray(floats, N, 0n))}`,
    '',
  ];
  await fs.writeFile(path, lines.join('\n'));
}

export { fieldToBeBytes32 };
