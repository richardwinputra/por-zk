import { promises as fs } from 'node:fs';
import { repoPath, RESULTS_DIR, resultPath } from './paths.js';
import { run, requireSuccess, PROOF_FLAGS } from './runner.js';
async function main() {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  for (const name of ['circuit', 'circuit_baseline']) {
    const compileTimes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await run('nargo', ['compile', '--force'], { cwd: repoPath(name) });
      requireSuccess(r, `Forced compilation ${name}`);
      compileTimes.push(Number(r.durationNs) / 1e6);
    }
    const gates = await run('bb', ['gates', '-s', 'ultra_honk', '--honk_recursion', '1', '-b', `target/${name}.json`], { cwd: repoPath(name) });
    requireSuccess(gates, `Gates ${name}`);
    const data = JSON.parse(gates.stdout.slice(gates.stdout.indexOf('{'))).functions[0];
    const metadata = { package: name, proof_flags: PROOF_FLAGS, acir_opcodes: data.acir_opcodes, ultra_honk_gates: data.circuit_size,
      gate_count_scope: 'finalized arithmetic circuit; excludes proof-system ZK masking overhead',
      compile_time_ms_runs: compileTimes, compile_time_ms_median: [...compileTimes].sort((a,b) => a-b)[2],
      compile_method: 'nargo compile --force, five runs, wall-clock subprocess duration', measured_utc: new Date().toISOString() };
    await fs.writeFile(resultPath(name === 'circuit' ? 'circuit_meta.json' : 'circuit_meta_baseline.json'), JSON.stringify(metadata, null, 2) + '\n');
    console.log(`${name}: ${data.circuit_size} finalized gates, ${data.acir_opcodes} ACIR opcodes`);
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
