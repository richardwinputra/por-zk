import { ROOT, RESULTS_DIR, resultPath, repoPath, VK_PATH, PROVER_NAME } from './paths.js';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { writeBaselineProverToml } from './witness.js';
import { destroyBb } from './pedersen.js';
import { USDM_TO_CENTS, padArray } from './types.js';
import { nargoExecute, bbProve, bbVerify, requireSuccess, PROOF_FLAGS } from './runner.js';
import { writeCsv } from './csv.js';

const BASE_DIR = path.join(ROOT, 'circuit_baseline');
const CIRCUIT_JSON = path.join('target', 'circuit_baseline.json');

const CONFIGS = [1, 2, 3, 4, 5];
const REPS = 30;

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6D2B79F5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function readSeed(): Promise<number> {
  const manifest = JSON.parse(await fs.readFile(resultPath('run_manifest.json'), 'utf8'));
  if (!Number.isSafeInteger(manifest.bench_seed)) throw new Error('Manifest requires an integer bench_seed');
  return Number(manifest.bench_seed) ^ 0x5b5b5b;
}

async function main() {
  await fs.access(resultPath('bench_baseline.csv')).then(
    () => { throw new Error('Existing bench_baseline.csv: select a fresh POR_RESULTS_DIR instead of overwriting raw measurements'); },
    (e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; });
  const startedUtc = new Date().toISOString();
  const seed = await readSeed();
  const rand = mulberry32(seed);

  const schedule: Array<{ config: number; run: number }> = [];
  for (const c of CONFIGS) for (let r = 0; r < REPS; r++) schedule.push({ config: c, run: r });
  const shuffled = shuffle(schedule, rand);

  console.log('warm-up x3...');
  const warmBalances = padArray<bigint>([20n, 20n, 20n].map(n => n * USDM_TO_CENTS), 10, 0n);
  await writeBaselineProverToml(path.join(BASE_DIR, `${PROVER_NAME}.toml`), 60n * USDM_TO_CENTS, warmBalances, [], []);
  for (let i = 0; i < 3; i++) {
    requireSuccess(await nargoExecute(BASE_DIR, PROVER_NAME, 'witness_warm'), 'warm-up execution');
    requireSuccess(await bbProve(BASE_DIR, CIRCUIT_JSON, path.join('target', 'witness_warm.gz'), path.join('target', 'proof_warm')), 'warm-up proving');
    requireSuccess(await bbVerify(BASE_DIR, 'target/proof_warm/proof', VK_PATH), 'warm-up verification');
  }

  const rows: any[] = [];
  for (let i = 0; i < shuffled.length; i++) {
    const { config, run: rep } = shuffled[i];
    const tag = 'warm' as const;
    const balances = padArray<bigint>(
      Array(config).fill(0).map(() => 20n * USDM_TO_CENTS),
      10, 0n,
    );
    const supply = BigInt(config * 20) * USDM_TO_CENTS;
    const witnessFile = path.join('target', `witness_b${config}_${rep}.gz`);
    const proofDir = path.join('target', `proof_b${config}_${rep}`);
    const proofPath = path.join(proofDir, 'proof');

    const tw0 = process.hrtime.bigint();
    await writeBaselineProverToml(path.join(BASE_DIR, `${PROVER_NAME}.toml`), supply, balances, [], []);
    const witness_ms = Number(process.hrtime.bigint() - tw0) / 1e6;

    const exec = await nargoExecute(BASE_DIR, PROVER_NAME, `witness_b${config}_${rep}`);
    requireSuccess(exec, 'exec measured run');
    const exec_ms = Number(exec.durationNs) / 1e6;

    const prove = await bbProve(BASE_DIR, CIRCUIT_JSON, witnessFile, proofDir);
    requireSuccess(prove, 'prove measured run');
    const prove_ms = Number(prove.durationNs) / 1e6;

    const verify = await bbVerify(BASE_DIR, proofPath, VK_PATH);
    requireSuccess(verify, 'verify measured run');
    const verify_ms = Number(verify.durationNs) / 1e6;

    let proof_bytes = 0;
    try {
      const st = await fs.stat(path.join(BASE_DIR, proofPath));
      proof_bytes = st.size;
    } catch { /* ignore */ }

    const ok = exec.ok && prove.ok && verify.ok;
    rows.push({ sequence: i + 1, measured_utc: new Date().toISOString(), config, run: rep, cold_or_warm: tag, witness_ms, exec_ms, prove_ms, verify_ms, proof_bytes, ok });

    if ((i + 1) % 10 === 0 || i === 0 || i === shuffled.length - 1) {
      console.log(`[${i + 1}/${shuffled.length}] cfg=${config} run=${rep} witness=${witness_ms} exec=${exec_ms} prove=${prove_ms} verify=${verify_ms} bytes=${proof_bytes} ok=${ok}`);
    }
  }

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await writeCsv(resultPath('bench_baseline.csv'),
    ['sequence','measured_utc','config','run','cold_or_warm','witness_ms','exec_ms','prove_ms','verify_ms','proof_bytes','ok'],
    rows);

  await fs.writeFile(resultPath('benchmark_baseline_run.json'), JSON.stringify({
    started_utc: startedUtc, completed_utc: new Date().toISOString(), seed,
    proof_flags: PROOF_FLAGS, warmup_runs: 3, measured_runs: rows.length, configs: CONFIGS, repetitions_per_config: REPS,
    capacity: 10, timing: 'wall-clock subprocess duration; fractional milliseconds; includes process startup and native initialization',
    end_to_end: 'sum of witness construction/file writing, execute, prove, verify; excludes cleanup and CSV/stat operations',
    scheduling: 'randomized within each circuit; circuits measured sequentially; run without concurrent analysis or tests',
    outlier_policy: 'retain every successful measured run; no trimming; unexpected native failures abort the experiment'
  }, null, 2) + '\n');
  const failed = rows.filter(r => !r.ok).length;
  console.log(`\n${rows.length} rows, ${failed} failed.`);
  await destroyBb();
  if (failed) process.exitCode = 1;
}

main().catch(async e => { await destroyBb(); console.error(e); process.exitCode = 1; });
