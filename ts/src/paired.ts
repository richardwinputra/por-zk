import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadOrCreateAuditorKey } from './schnorr.js';
import { buildWitness, writeProverToml } from './witness.js';
import { destroyBb } from './pedersen.js';
import { Scenario, USDM_TO_CENTS } from './types.js';
import { nargoExecute, bbProve, bbVerify } from './runner.js';
import { writeCsv } from './csv.js';

const ROOT = path.resolve(process.cwd());
const CIRCUIT_DIR = path.join(ROOT, 'circuit');
const CIRCUIT_JSON = path.join('target', 'circuit.json');
const VK_PATH = path.join('target', 'vk', 'vk');

const POLICY_TEST = 'data/case_study/policy_test.json';

const baseBalances = [30,25,25,18,15].map(n => BigInt(n) * USDM_TO_CENTS);

const A: Scenario = {
  id: 'A',
  name: 'Paired A: all eligible',
  realCount: 5,
  balancesCents: baseBalances,
  eligibility: [1,1,1,1,1],
  supplyCents: 100n * USDM_TO_CENTS,
  snapshotId: 20230306n,
  policyJsonPath: POLICY_TEST,
  policySalt: 0x5a17n,
  expectAccept: true,
  tamper: { kind: 'none' },
};

const B: Scenario = {
  id: 'B',
  name: 'Paired B: accounts 4-5 ineligible',
  realCount: 5,
  balancesCents: baseBalances,
  eligibility: [1,1,1,0,0],
  supplyCents: 100n * USDM_TO_CENTS,
  snapshotId: 20230306n,
  policyJsonPath: POLICY_TEST,
  policySalt: 0x5a17n,
  expectAccept: false,
  tamper: { kind: 'none' },
};

async function runOne(s: Scenario, auditor: any): Promise<{ id: string; effective_total: string; accepted: boolean; expected: boolean }> {
  const w = await buildWitness(s, auditor);
  await writeProverToml(path.join(CIRCUIT_DIR, 'Prover.toml'), w);
  const witnessFile = path.join('target', `witness_paired_${s.id}.gz`);
  const proofDir = path.join('target', `proof_paired_${s.id}`);
  const proofPath = path.join(proofDir, 'proof');

  const exec = await nargoExecute(CIRCUIT_DIR, 'Prover', `witness_paired_${s.id}`);
  if (!exec.ok) {
    return { id: s.id, effective_total: w.effectiveTotal.toString(), accepted: false, expected: s.expectAccept };
  }
  const prove = await bbProve(CIRCUIT_DIR, CIRCUIT_JSON, witnessFile, proofDir);
  if (!prove.ok) return { id: s.id, effective_total: w.effectiveTotal.toString(), accepted: false, expected: s.expectAccept };
  const verify = await bbVerify(CIRCUIT_DIR, proofPath, VK_PATH);
  return { id: s.id, effective_total: w.effectiveTotal.toString(), accepted: verify.ok, expected: s.expectAccept };
}

async function main() {
  const auditor = await loadOrCreateAuditorKey('data/auditor_key.json');
  const rows = [];
  for (const s of [A, B]) {
    process.stdout.write(`Paired ${s.id} ${s.name}... `);
    const r = await runOne(s, auditor);
    rows.push({ ...r, name: s.name });
    process.stdout.write(`accepted=${r.accepted} expected=${r.expected} effective=${(BigInt(r.effective_total) / USDM_TO_CENTS).toString()} USDm\n`);
  }

  await fs.mkdir('data/results', { recursive: true });
  await writeCsv('data/results/paired.csv',
    ['id','name','effective_total','accepted','expected'], rows as any);

  const ok = rows.every(r => r.accepted === r.expected);
  console.log(ok ? '\nPaired experiment OK.' : '\nPaired experiment MISMATCH.');
  await destroyBb();
  if (!ok) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
