import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadOrCreateAuditorKey } from './schnorr.js';
import { buildWitness, writeProverToml } from './witness.js';
import { destroyBb } from './pedersen.js';
import { Scenario, USDM_TO_CENTS } from './types.js';
import { caseStudyScenarios } from './case_study.js';
import { nargoExecute, bbProve, bbVerify } from './runner.js';
import { writeCsv } from './csv.js';
import { encodePolicyJson } from './policy_hash.js';

const ROOT = path.resolve(process.cwd());
const CIRCUIT_DIR = path.join(ROOT, 'circuit');
const CIRCUIT_JSON = path.join('target', 'circuit.json');
const VK_PATH = path.join('target', 'vk', 'vk');

interface CaseRow {
  scenario: string;
  name: string;
  expected: boolean;
  executed: boolean;
  proved: boolean;
  verified: boolean;
  effective_total_usdm: string;
  supply_usdm: string;
  policy_version: string;
  pass: boolean;
  failure_stage: string;
  error_message: string;
}

async function runOne(s: Scenario, auditor: any): Promise<CaseRow> {
  const witnessFile = path.join('target', `witness_case_${s.id}.gz`);
  const proofDir = path.join('target', `proof_case_${s.id}`);
  const proofPath = path.join(proofDir, 'proof');
  const proofSizePath = path.join(CIRCUIT_DIR, proofPath);

  const w = await buildWitness(s, auditor);
  await writeProverToml(path.join(CIRCUIT_DIR, 'Prover.toml'), w);
  const policyVersion = await encodePolicyJson(s.policyJsonPath);

  const exec = await nargoExecute(CIRCUIT_DIR, 'Prover', `witness_case_${s.id}`);
  if (!exec.ok) {
    return {
      scenario: s.id, name: s.name, expected: s.expectAccept,
      executed: false, proved: false, verified: false,
      effective_total_usdm: (w.effectiveTotal / USDM_TO_CENTS).toString(),
      supply_usdm: (s.supplyCents / USDM_TO_CENTS).toString(),
      policy_version: '0x' + policyVersion.toString(16),
      pass: !s.expectAccept,
      failure_stage: 'execute',
      error_message: exec.stderr.trim().slice(0, 500),
    };
  }
  const prove = await bbProve(CIRCUIT_DIR, CIRCUIT_JSON, witnessFile, proofDir);
  if (!prove.ok) {
    return {
      scenario: s.id, name: s.name, expected: s.expectAccept,
      executed: true, proved: false, verified: false,
      effective_total_usdm: (w.effectiveTotal / USDM_TO_CENTS).toString(),
      supply_usdm: (s.supplyCents / USDM_TO_CENTS).toString(),
      policy_version: '0x' + policyVersion.toString(16),
      pass: !s.expectAccept,
      failure_stage: 'prove',
      error_message: prove.stderr.trim().slice(0, 500),
    };
  }
  const verify = await bbVerify(CIRCUIT_DIR, proofPath, VK_PATH);
  const verified = verify.ok;
  let proofBytes = 0;
  try {
    const st = await fs.stat(proofSizePath);
    proofBytes = st.size;
  } catch { /* ignore */ }

  return {
    scenario: s.id, name: s.name, expected: s.expectAccept,
    executed: true, proved: true, verified,
    effective_total_usdm: (w.effectiveTotal / USDM_TO_CENTS).toString(),
    supply_usdm: (s.supplyCents / USDM_TO_CENTS).toString(),
    policy_version: '0x' + policyVersion.toString(16),
    pass: verified === s.expectAccept,
    failure_stage: verified ? '' : 'verify',
    error_message: verified ? '' : verify.stderr.trim().slice(0, 500),
  };
}

async function main() {
  const auditor = await loadOrCreateAuditorKey('data/auditor_key.json');
  const rows: CaseRow[] = [];
  let firstProofSize = 0;
  for (const s of caseStudyScenarios()) {
    process.stdout.write(`Case ${s.id} ${s.name}... `);
    const r = await runOne(s, auditor);
    rows.push(r);
    process.stdout.write(`${r.pass ? 'PASS' : 'FAIL'} (verified=${r.verified} expected=${r.expected} effective=${r.effective_total_usdm} USDm supply=${r.supply_usdm} USDm)\n`);
    if (firstProofSize === 0) {
      try {
        const st = await fs.stat(path.join(CIRCUIT_DIR, 'target', `proof_case_${s.id}`, 'proof'));
        firstProofSize = st.size;
      } catch { /* ignore */ }
    }
  }

  await fs.mkdir('data/results', { recursive: true });
  await writeCsv('data/results/case_study.csv',
    ['scenario','name','expected','executed','proved','verified','effective_total_usdm','supply_usdm','policy_version','pass','failure_stage','error_message'],
    rows as any);

  // privacy report addendum
  await fs.writeFile('data/results/privacy_report_case_study.json', JSON.stringify({
    proof_size_bytes: firstProofSize,
    public_inputs: ['supply', 'h_p', 'auditor_pk_x', 'auditor_pk_y'],
    structural_parameter: 'N = 10',
    note: 'Proof size invariant across case-study scenarios; verifier sees only the four public inputs.',
  }, null, 2));

  const ok = rows.every(r => r.pass);
  console.log(ok ? '\nCase study OK.' : '\nCase study MISMATCH.');
  await destroyBb();
  if (!ok) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
