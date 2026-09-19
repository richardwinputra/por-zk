import { promises as fs } from 'node:fs';
import { repoPath, RESULTS_DIR, resultPath } from './paths.js';
import { loadOrCreateAuditorKey } from './schnorr.js';
import { destroyBb } from './pedersen.js';
import { caseStudyScenarios } from './case_study.js';
import { USDM_TO_CENTS } from './types.js';
import { runScenario } from './scenario_runner.js';
import { writeCsv } from './csv.js';

async function main() {
  try {
    const auditor = await loadOrCreateAuditorKey(repoPath('data/auditor_key.json'));
    const rows = [];
    for (const s of caseStudyScenarios()) {
      const r = await runScenario(s, auditor, 'case_');
      rows.push({ ...r, expected: s.expectAccept, effective_total_usdm: (BigInt(r.effective_total) / USDM_TO_CENTS).toString(), supply_usdm: (s.supplyCents / USDM_TO_CENTS).toString() });
      console.log(`${r.pass ? 'PASS' : 'FAIL'} ${s.id}: ${r.failure_reason || 'accept'}`);
    }
    await fs.mkdir(RESULTS_DIR, { recursive: true });
    await writeCsv(resultPath('case_study.csv'), Object.keys(rows[0]), rows);
    if (rows.some(r => !r.pass)) process.exitCode = 1;
  } finally { await destroyBb(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
