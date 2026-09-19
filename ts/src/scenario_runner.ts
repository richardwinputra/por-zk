import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { repoPath, VK_PATH, PROVER_NAME } from './paths.js';
import { buildWitness, writeProverToml } from './witness.js';
import type { AuditorKey } from './schnorr.js';
import type { Scenario } from './types.js';
import { nargoExecute, bbProve, bbVerify } from './runner.js';
import { classifyFailure, matchesExpectedRejection, expectedRejection } from './validation.js';

export async function runScenario(s: Scenario, auditor: AuditorKey, prefix = '') {
  const cwd = repoPath('circuit');
  const tag = `${prefix}${s.id}`;
  const witnessName = `witness_${tag}`;
  const proofDir = path.join('target', `proof_${tag}`);
  const row = { scenario: s.id, name: s.name, expectAccept: s.expectAccept, executed: false, proved: false, verified: false,
    effective_total: '0', supply: s.supplyCents.toString(), policy_version: '', proof_bytes: 0, pass: false,
    expected_failure: expectedRejection(s) ?? '', failure_stage: '', failure_reason: '', error_message: '' };
  const failed = (stage: string, message: string) => {
    row.failure_stage = stage;
    row.failure_reason = classifyFailure(stage, message);
    row.error_message = message.split(repoPath() + path.sep).join('').slice(0, 2000);
    row.pass = matchesExpectedRejection(s, stage, message);
    return row;
  };
  try {
    const w = await buildWitness(s, auditor);
    row.effective_total = w.effectiveTotal.toString();
    row.policy_version = '0x' + w.policyVersion.toString(16);
    await writeProverToml(path.join(cwd, `${PROVER_NAME}.toml`), w);
  } catch (e) { return failed('witness', String(e)); }
  const execute = await nargoExecute(cwd, PROVER_NAME, witnessName);
  if (!execute.ok) return failed('execute', execute.stdout + execute.stderr);
  row.executed = true;
  const prove = await bbProve(cwd, 'target/circuit.json', `target/${witnessName}.gz`, proofDir);
  if (!prove.ok) return failed('prove', prove.stdout + prove.stderr);
  row.proved = true;
  const verify = await bbVerify(cwd, path.join(proofDir, 'proof'), VK_PATH);
  if (!verify.ok) return failed('verify', verify.stdout + verify.stderr);
  row.verified = true;
  row.proof_bytes = (await fs.stat(path.join(cwd, proofDir, 'proof'))).size;
  row.pass = s.expectAccept;
  return row;
}
