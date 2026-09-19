import { promises as fs } from 'node:fs';
import { repoPath, RESULTS_DIR, resultPath } from './paths.js';
import { loadOrCreateAuditorKey } from './schnorr.js';
import { destroyBb } from './pedersen.js';
import { syntheticScenarios, attestationScenarios } from './scenarios.js';
import { tamperScenarios } from './tamper_scenarios.js';
import { runScenario } from './scenario_runner.js';
import { writeCsv } from './csv.js';

async function main() {
  try {
    const auditor = await loadOrCreateAuditorKey(repoPath('data/auditor_key.json'));
    const rows = [];
    for (const s of [...syntheticScenarios(), ...attestationScenarios(), ...tamperScenarios()]) {
      const row = await runScenario(s, auditor);
      rows.push(row);
      console.log(`${row.pass ? 'PASS' : 'FAIL'} ${s.id}: expected=${row.expected_failure || 'accept'} actual=${row.failure_reason || 'accept'}`);
    }
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    await writeCsv(resultPath('correctness.csv'), Object.keys(rows[0]), rows);
    console.log(`${rows.filter(r => r.pass).length}/${rows.length} correctness tests passed`);
    if (rows.some(r => !r.pass)) process.exitCode = 1;
  } finally { await destroyBb(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
