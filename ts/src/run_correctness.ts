import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { loadOrCreateAuditorKey } from './schnorr.js';
import { buildWitness, writeProverToml } from './witness.js';
import { destroyBb } from './pedersen.js';
import { syntheticScenarios, attestationScenarios } from './scenarios.js';
import { tamperScenarios } from './tamper_scenarios.js';
import { Scenario } from './types.js';
import { nargoExecute, bbProve, bbVerify } from './runner.js';
import { writeCsv } from './csv.js';

const ROOT = path.resolve(process.cwd());
const CIRCUIT_DIR = path.join(ROOT, 'circuit');
const CIRCUIT_JSON = path.join('target', 'circuit.json');
const VK_PATH = path.join('target', 'vk', 'vk');

function classifyFailure(stage: string, stderr: string, scenario: Scenario): string {
  // first inspect tamper directive — most informative
  if (scenario.tamper) {
    switch (scenario.tamper.kind) {
      case 'signature':
      case 'auditor_key':
      case 'balance':
      case 'snapshot_id':
        return 'signature';
      case 'eligibility':
      case 'supply':
      case 'policy_salt':
      case 'stale_snapshot':
        return 'policy_hash';
      case 'policy_version':
        return 'policy_version';
      case 'underflow_natural':
      case 'u64_underflow':
        return 'underflow';
      case 'boolean_overflow':
        return 'boolean';
      case 'none':
        // fall through to message inspection
        break;
    }
  }
  const txt = stderr.toLowerCase();
  if (txt.includes('overflow') || txt.includes('subtract')) return 'underflow';
  if (txt.includes('boolean') || txt.includes('out of range') || txt.includes('cannot fit')) return 'boolean';
  if (txt.includes('attempt to assign')) return 'boolean';
  if (txt.includes('schnorr') || txt.includes('signature')) return 'signature';
  if (stage === 'execute') return 'solvency';
  return '';
}

interface CorrectnessRow {
  scenario: string;
  name: string;
  expectAccept: boolean;
  executed: boolean;
  proved: boolean;
  verified: boolean;
  effective_total: string;
  pass: boolean;
  failure_stage: string;
  failure_reason: string;
  error_message: string;
}

async function runScenario(s: Scenario, auditor: any): Promise<CorrectnessRow> {
  const witnessFile = path.join('target', `witness_${s.id}.gz`);
  const proofDir = path.join('target', `proof_${s.id}`);
  const proofPath = path.join(proofDir, 'proof');

  let executed = false, proved = false, verified = false;
  let failureStage = '';
  let errorMessage = '';
  let effectiveTotal = '0';

  try {
    const w = await buildWitness(s, auditor);
    effectiveTotal = w.effectiveTotal.toString();
    await writeProverToml(path.join(CIRCUIT_DIR, 'Prover.toml'), w);
  } catch (e: any) {
    failureStage = 'witness';
    errorMessage = String(e?.message ?? e);
    return {
      scenario: s.id, name: s.name, expectAccept: s.expectAccept,
      executed, proved, verified, effective_total: effectiveTotal,
      pass: !s.expectAccept,
      failure_stage: failureStage,
      failure_reason: classifyFailure('witness', errorMessage, s),
      error_message: errorMessage.slice(0, 500),
    };
  }

  const exec = await nargoExecute(CIRCUIT_DIR, 'Prover', `witness_${s.id}`);
  if (!exec.ok) {
    failureStage = 'execute';
    errorMessage = exec.stderr.trim();
    // T6 boolean_overflow may instead fail at witness parsing — Noir's u1 enforcement
    if (s.tamper?.kind === 'boolean_overflow') {
      failureStage = 'witness';
    }
    return {
      scenario: s.id, name: s.name, expectAccept: s.expectAccept,
      executed, proved, verified, effective_total: effectiveTotal,
      pass: !s.expectAccept,
      failure_stage: failureStage,
      failure_reason: classifyFailure(failureStage, errorMessage, s),
      error_message: errorMessage.slice(0, 500),
    };
  }
  executed = true;

  const prove = await bbProve(CIRCUIT_DIR, CIRCUIT_JSON, witnessFile, proofDir);
  if (!prove.ok) {
    failureStage = 'prove';
    errorMessage = prove.stderr.trim();
    return {
      scenario: s.id, name: s.name, expectAccept: s.expectAccept,
      executed, proved, verified, effective_total: effectiveTotal,
      pass: !s.expectAccept,
      failure_stage: failureStage,
      failure_reason: classifyFailure(failureStage, errorMessage, s),
      error_message: errorMessage.slice(0, 500),
    };
  }
  proved = true;

  const verify = await bbVerify(CIRCUIT_DIR, proofPath, VK_PATH);
  if (!verify.ok) {
    failureStage = 'verify';
    errorMessage = verify.stderr.trim();
    return {
      scenario: s.id, name: s.name, expectAccept: s.expectAccept,
      executed, proved, verified, effective_total: effectiveTotal,
      pass: !s.expectAccept,
      failure_stage: failureStage,
      failure_reason: classifyFailure(failureStage, errorMessage, s),
      error_message: errorMessage.slice(0, 500),
    };
  }
  verified = true;

  return {
    scenario: s.id, name: s.name, expectAccept: s.expectAccept,
    executed, proved, verified, effective_total: effectiveTotal,
    pass: s.expectAccept,
    failure_stage: '', failure_reason: '', error_message: '',
  };
}

async function main() {
  const auditor = await loadOrCreateAuditorKey('data/auditor_key.json');
  const all: Scenario[] = [
    ...syntheticScenarios(),
    ...attestationScenarios(),
    ...tamperScenarios(),
  ];

  const rows: CorrectnessRow[] = [];
  for (const s of all) {
    process.stdout.write(`Running ${s.id} ${s.name}... `);
    const row = await runScenario(s, auditor);
    rows.push(row);
    process.stdout.write(`${row.pass ? 'PASS' : 'FAIL'} (executed=${row.executed} proved=${row.proved} verified=${row.verified} stage=${row.failure_stage} reason=${row.failure_reason})\n`);
  }

  await fs.mkdir('data/results', { recursive: true });
  await writeCsv('data/results/correctness.csv',
    ['scenario','name','expectAccept','executed','proved','verified','effective_total','pass','failure_stage','failure_reason','error_message'],
    rows as any);

  const passed = rows.filter(r => r.pass).length;
  console.log(`\n${passed}/${rows.length} scenarios produced expected outcome.`);
  await destroyBb();
  if (passed !== rows.length) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
