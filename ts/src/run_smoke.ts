import { promises as fs } from 'node:fs';
import { repoPath, RESULTS_DIR, resultPath, PROVER_NAME, VK_PATH } from './paths.js';
import { syntheticScenarios } from './scenarios.js';
import { loadOrCreateAuditorKey } from './schnorr.js';
import { runScenario } from './scenario_runner.js';
import { writeBaselineProverToml } from './witness.js';
import { destroyBb } from './pedersen.js';
import { nargoExecute, bbProve, bbVerify, requireSuccess, PROOF_FLAGS } from './runner.js';
async function main() {
  try {
    const auditor = await loadOrCreateAuditorKey(repoPath('data/auditor_key.json'));
    const s = syntheticScenarios()[0];
    const policy = await runScenario(s, auditor, 'smoke_');
    if (!policy.pass || !policy.verified) throw new Error(JSON.stringify(policy));
    const cwd = repoPath('circuit_baseline');
    await writeBaselineProverToml(repoPath('circuit_baseline', `${PROVER_NAME}.toml`), s.supplyCents, s.balancesCents, [], []);
    requireSuccess(await nargoExecute(cwd, PROVER_NAME, 'witness_smoke'), 'baseline execute');
    requireSuccess(await bbProve(cwd, 'target/circuit_baseline.json', 'target/witness_smoke.gz', 'target/proof_smoke'), 'baseline prove');
    requireSuccess(await bbVerify(cwd, 'target/proof_smoke/proof', VK_PATH), 'baseline verify');
    const baselineBytes = (await fs.stat(repoPath('circuit_baseline/target/proof_smoke/proof'))).size;
    const summary = { scope: 'One valid witness per circuit; not a performance benchmark', proof_flags: PROOF_FLAGS,
      policy: { verified: true, proof_bytes: policy.proof_bytes }, baseline: { verified: true, proof_bytes: baselineBytes } };
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    await fs.writeFile(resultPath('smoke.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(summary);
  } finally { await destroyBb(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
