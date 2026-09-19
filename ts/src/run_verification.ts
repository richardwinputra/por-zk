import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { repoPath, RESULTS_DIR, resultPath } from './paths.js';
import { syntheticScenarios } from './scenarios.js';
import { loadOrCreateAuditorKey } from './schnorr.js';
import { buildWitness } from './witness.js';
import { destroyBb } from './pedersen.js';
import { runScenario } from './scenario_runner.js';
import { bbVerify, requireSuccess } from './runner.js';
import { verifyForSnapshot, sha256, readPublicInputs, isCryptographicRejection, type TrustedSnapshot } from './verify_snapshot.js';
import { writeCsv } from './csv.js';
async function main() {
  try {
    const auditor = await loadOrCreateAuditorKey(repoPath('data/auditor_key.json'));
    const s = syntheticScenarios()[0];
    const row = await runScenario(s, auditor, 'verification_');
    assert.ok(row.verified && row.pass);
    const witness = await buildWitness(s, auditor);
    const proofPath = repoPath('circuit/target/proof_verification_1/proof');
    const vkPath = repoPath('circuit/target/vk-zk/vk');
    const proof = await fs.readFile(proofPath);
    const expectedInputs = [witness.supply, witness.hP, witness.auditorPkX, witness.auditorPkY];
    assert.deepEqual(readPublicInputs(proof), expectedInputs);
    // Fixture models an authenticated registry response; not production registry infrastructure.
    const now = Date.now();
    const trusted: TrustedSnapshot = { snapshotId: witness.snapshotId.toString(), policyVersion: witness.policyVersion,
      policyDigest: witness.hP, supply: witness.supply, auditorPkX: witness.auditorPkX, auditorPkY: witness.auditorPkY,
      verificationKeySha256: sha256(await fs.readFile(vkPath)), validFrom: new Date(now - 60_000).toISOString(), validUntil: new Date(now + 60_000).toISOString() };
    const results: { scenario: string; expected: string; observed: string; pass: boolean }[] = [];
    const record = (scenario: string, expected: string, observed: string) => {
      results.push({ scenario, expected, observed, pass: expected === observed });
      console.log(`${expected === observed ? 'PASS' : 'FAIL'} ${scenario}: ${observed}`);
    };
    const check = async (name: string, context: TrustedSnapshot, expected: string, policyPath = s.policyJsonPath, input = proofPath, vk = vkPath) => {
      const result = await verifyForSnapshot(input, vk, policyPath, context, now);
      record(name, expected, result.reason);
    };
    await check('approved-current-snapshot', trusted, 'accepted');
    for (const [i, name] of ['supply', 'policy-digest', 'auditor-x', 'auditor-y'].entries()) {
      const changed = Buffer.from(proof);
      Buffer.from((expectedInputs[i] + 1n).toString(16).padStart(64, '0'), 'hex').copy(changed, 4 + i * 32);
      const changedPath = repoPath('circuit/target', `mutated-${name}.proof`);
      await fs.writeFile(changedPath, changed);
      const native = await bbVerify(repoPath('circuit'), changedPath, vkPath);
      if (!native.ok && !isCryptographicRejection(native)) throw new Error(`Unexpected verifier failure: ${native.stdout}\n${native.stderr}`);
      record(`native-altered-${name}`, 'rejected', native.ok ? 'accepted' : 'rejected');
    }
    requireSuccess(await bbVerify(repoPath('circuit'), proofPath, vkPath), 'unchanged old proof');
    record('unchanged-proof-still-cryptographically-valid', 'accepted', 'accepted');
    await check('old-proof-against-new-registry-record', { ...trusted, snapshotId: '20230307', policyDigest: trusted.policyDigest + 1n }, 'snapshot_digest_mismatch');
    await check('unexpected-supply', { ...trusted, supply: trusted.supply + 1n }, 'supply_mismatch');
    await check('unapproved-auditor', { ...trusted, auditorPkX: trusted.auditorPkX + 1n }, 'unapproved_auditor');
    await check('expired-record', { ...trusted, validFrom: new Date(now - 120_000).toISOString(), validUntil: new Date(now - 1).toISOString() }, 'snapshot_not_current');
    await check('future-record', { ...trusted, validFrom: new Date(now + 1).toISOString() }, 'snapshot_not_current');
    await check('wrong-policy-document', trusted, 'policy_document_mismatch', 'data/case_study/policy_9a.json');
    await check('wrong-verification-key', trusted, 'unapproved_verification_key', s.policyJsonPath, proofPath, repoPath('circuit_baseline/target/vk-zk/vk'));
    const malformedPath = repoPath('circuit/target/malformed.proof');
    await fs.writeFile(malformedPath, proof.subarray(0, 80));
    await check('malformed-proof', trusted, 'malformed_proof', s.policyJsonPath, malformedPath);
    const corrupted = Buffer.from(proof); corrupted[corrupted.length - 1] ^= 1;
    const corruptedPath = repoPath('circuit/target/corrupted.proof'); await fs.writeFile(corruptedPath, corrupted);
    await check('corrupted-transcript', trusted, 'invalid_proof', s.policyJsonPath, corruptedPath);
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    await writeCsv(resultPath('verification.csv'), ['scenario', 'expected', 'observed', 'pass'], results);
    assert.ok(results.every(r => r.pass), 'Verification suite failed');
    console.log(`${results.length}/${results.length} verification tests passed`);
  } finally { await destroyBb(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
