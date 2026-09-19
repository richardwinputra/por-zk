import { promises as fs } from 'node:fs';
import { repoPath, RESULTS_DIR, resultPath } from './paths.js';
import { loadOrCreateAuditorKey } from './schnorr.js';
import { destroyBb } from './pedersen.js';
import { syntheticScenarios } from './scenarios.js';
import { runScenario } from './scenario_runner.js';
import { writeCsv } from './csv.js';

async function main() {
  try {
    const auditor = await loadOrCreateAuditorKey(repoPath('data/auditor_key.json'));
    const base = syntheticScenarios()[0];
    const rows = [];
    for (const s of [{ ...base, id: 'A', name: 'Paired A: all eligible' }, { ...base, id: 'B', name: 'Paired B: accounts 4-5 ineligible', eligibility: [1,1,1,0,0], expectAccept: false }]) {
      const r = await runScenario(s, auditor, 'paired_');
      rows.push({ ...r, id: s.id, accepted: r.verified, expected: s.expectAccept });
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${s.id}: ${r.failure_reason || 'accept'}`);
    }
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    await writeCsv(resultPath('paired.csv'), Object.keys(rows[0]), rows);
    if (rows.some(r => !r.pass)) process.exitCode = 1;
  } finally { await destroyBb(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
