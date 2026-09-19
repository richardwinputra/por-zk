import { ROOT, RESULTS_DIR, resultPath, repoPath, VK_PATH, PROVER_NAME } from './paths.js';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadOrCreateAuditorKey } from './schnorr.js';
import { buildWitness, writeProverToml } from './witness.js';
import { destroyBb } from './pedersen.js';
import { Scenario, USDM_TO_CENTS } from './types.js';
import { nargoExecute, bbProve, bbVerify, requireSuccess, PROOF_FLAGS } from './runner.js';
import { writeCsv } from './csv.js';

const CIRCUIT_DIR = path.join(ROOT, 'circuit');
const CIRCUIT_JSON = path.join('target', 'circuit.json');

const CONFIGS = [1, 2, 3, 4, 5];
const REPS = 30;

const POLICY_TEST = 'data/case_study/policy_test.json';

function makeScenario(realCount: number): Scenario {
  // solvent, all-eligible witness for `realCount` real slots; balances 20 USDm each
  const balances = Array(realCount).fill(20);
  const elig = Array(realCount).fill(1);
  const supply = realCount * 20; // exactly solvent
  return {
    id: `bench${realCount}`,
    name: `bench config ${realCount}`,
    realCount,
    balancesCents: balances.map(n => BigInt(n) * USDM_TO_CENTS),
    eligibility: elig,
    supplyCents: BigInt(supply) * USDM_TO_CENTS,
    snapshotId: 20230306n,
    policyJsonPath: POLICY_TEST,
    policySalt: 0x5a17n,
    expectAccept: true,
    tamper: { kind: 'none' },
  };
}

// Mulberry32 deterministic PRNG (seed reproducibility)
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

interface BenchRow {
  sequence: number;
  measured_utc: string;
  config: number;
  run: number;
  cold_or_warm: 'cold' | 'warm';
  witness_ms: number;
  exec_ms: number;
  prove_ms: number;
  verify_ms: number;
  proof_bytes: number;
  ok: boolean;
}

async function readSeed(): Promise<number> {
  const manifest = JSON.parse(await fs.readFile(resultPath('run_manifest.json'), 'utf8'));
  if (!Number.isSafeInteger(manifest.bench_seed)) throw new Error('Manifest requires an integer bench_seed');
  return Number(manifest.bench_seed);
}

async function main() {
  await fs.access(resultPath('bench.csv')).then(
    () => { throw new Error('Existing bench.csv: select a fresh POR_RESULTS_DIR instead of overwriting raw measurements'); },
    (e: NodeJS.ErrnoException) => { if (e.code !== 'ENOENT') throw e; });
  const startedUtc = new Date().toISOString();
  const auditor = await loadOrCreateAuditorKey(repoPath('data/auditor_key.json'));
  const seed = await readSeed();
  const rand = mulberry32(seed);

  const schedule: Array<{ config: number; run: number }> = [];
  for (const c of CONFIGS) {
    for (let r = 0; r < REPS; r++) schedule.push({ config: c, run: r });
  }
  const shuffled = shuffle(schedule, rand);

  console.log('warm-up x3...');
  const warmScenario = makeScenario(3);
  const warmWitness = await buildWitness(warmScenario, auditor);
  await writeProverToml(path.join(CIRCUIT_DIR, `${PROVER_NAME}.toml`), warmWitness);
  for (let i = 0; i < 3; i++) {
    requireSuccess(await nargoExecute(CIRCUIT_DIR, PROVER_NAME, 'witness_warm'), 'warm-up execution');
    requireSuccess(await bbProve(CIRCUIT_DIR, CIRCUIT_JSON, path.join('target', 'witness_warm.gz'), path.join('target', 'proof_warm')), 'warm-up proving');
    requireSuccess(await bbVerify(CIRCUIT_DIR, 'target/proof_warm/proof', VK_PATH), 'warm-up verification');
  }

  const rows: BenchRow[] = [];
  for (let i = 0; i < shuffled.length; i++) {
    const { config, run: rep } = shuffled[i];
    const tag = 'warm' as const;
    const s = makeScenario(config);
    const witnessFile = path.join('target', `witness_b${config}_${rep}.gz`);
    const proofDir = path.join('target', `proof_b${config}_${rep}`);
    const proofPath = path.join(proofDir, 'proof');

    const tw0 = process.hrtime.bigint();
    const w = await buildWitness(s, auditor);
    await writeProverToml(path.join(CIRCUIT_DIR, `${PROVER_NAME}.toml`), w);
    const witness_ms = Number(process.hrtime.bigint() - tw0) / 1e6;

    const exec = await nargoExecute(CIRCUIT_DIR, PROVER_NAME, `witness_b${config}_${rep}`);
    requireSuccess(exec, 'exec measured run');
    const exec_ms = Number(exec.durationNs) / 1e6;

    const prove = await bbProve(CIRCUIT_DIR, CIRCUIT_JSON, witnessFile, proofDir);
    requireSuccess(prove, 'prove measured run');
    const prove_ms = Number(prove.durationNs) / 1e6;

    const verify = await bbVerify(CIRCUIT_DIR, proofPath, VK_PATH);
    requireSuccess(verify, 'verify measured run');
    const verify_ms = Number(verify.durationNs) / 1e6;

    let proof_bytes = 0;
    try {
      const st = await fs.stat(path.join(CIRCUIT_DIR, proofPath));
      proof_bytes = st.size;
    } catch { /* ignore */ }

    const ok = exec.ok && prove.ok && verify.ok;
    rows.push({ sequence: i + 1, measured_utc: new Date().toISOString(), config, run: rep, cold_or_warm: tag, witness_ms, exec_ms, prove_ms, verify_ms, proof_bytes, ok });

    if ((i + 1) % 10 === 0 || i === 0 || i === shuffled.length - 1) {
      console.log(`[${i + 1}/${shuffled.length}] cfg=${config} run=${rep} witness=${witness_ms} exec=${exec_ms} prove=${prove_ms} verify=${verify_ms} bytes=${proof_bytes} ok=${ok}`);
    }
  }

  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await writeCsv(resultPath('bench.csv'),
    ['sequence','measured_utc','config','run','cold_or_warm','witness_ms','exec_ms','prove_ms','verify_ms','proof_bytes','ok'],
    rows as any);

  const sizes = Array.from(new Set(rows.map(r => r.proof_bytes)));
  await fs.writeFile(resultPath('privacy_report.json'), JSON.stringify({
    proof_size_bytes_unique: sizes,
    proof_size_invariant: sizes.length === 1,
    public_inputs: ['supply', 'h_p', 'auditor_pk_x', 'auditor_pk_y'],
    structural_parameter: 'N = 10',
    note: 'Size invariance is a structural observation, not evidence of zero knowledge. ZK is enabled by the pinned proving configuration.',
    seed,
  }, null, 2));

  await fs.writeFile(resultPath('benchmark_policy_run.json'), JSON.stringify({
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
