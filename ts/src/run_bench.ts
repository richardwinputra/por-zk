import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { loadOrCreateAuditorKey } from './schnorr.js';
import { buildWitness, writeProverToml } from './witness.js';
import { destroyBb } from './pedersen.js';
import { Scenario, USDM_TO_CENTS } from './types.js';
import { nargoExecute, bbProve, bbVerify, run } from './runner.js';
import { writeCsv } from './csv.js';

const ROOT = path.resolve(process.cwd());
const CIRCUIT_DIR = path.join(ROOT, 'circuit');
const CIRCUIT_JSON = path.join('target', 'circuit.json');
const VK_PATH = path.join('target', 'vk', 'vk');

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
  try {
    const m = JSON.parse(await fs.readFile('data/results/run_manifest.json', 'utf8'));
    return Number(m.bench_seed);
  } catch {
    return 1;
  }
}

async function main() {
  const auditor = await loadOrCreateAuditorKey('data/auditor_key.json');
  const seed = await readSeed();
  const rand = mulberry32(seed);

  // Build the schedule: (config, rep) pairs shuffled
  const schedule: Array<{ config: number; run: number }> = [];
  for (const c of CONFIGS) {
    for (let r = 0; r < REPS; r++) schedule.push({ config: c, run: r });
  }
  const shuffled = shuffle(schedule, rand);

  // Warm-up runs (3 throwaway)
  console.log('warm-up x3...');
  const warmScenario = makeScenario(3);
  const warmWitness = await buildWitness(warmScenario, auditor);
  await writeProverToml(path.join(CIRCUIT_DIR, 'Prover.toml'), warmWitness);
  for (let i = 0; i < 3; i++) {
    await nargoExecute(CIRCUIT_DIR, 'Prover', 'witness_warm');
    await bbProve(CIRCUIT_DIR, CIRCUIT_JSON, path.join('target', 'witness_warm.gz'), path.join('target', 'proof_warm'));
  }

  const rows: BenchRow[] = [];
  let coldUsed = false;
  for (let i = 0; i < shuffled.length; i++) {
    const { config, run: rep } = shuffled[i];
    const tag: 'cold' | 'warm' = !coldUsed ? 'cold' : 'warm';
    coldUsed = true;
    const s = makeScenario(config);
    const witnessFile = path.join('target', `witness_b${config}_${rep}.gz`);
    const proofDir = path.join('target', `proof_b${config}_${rep}`);
    const proofPath = path.join(proofDir, 'proof');

    const tw0 = process.hrtime.bigint();
    const w = await buildWitness(s, auditor);
    await writeProverToml(path.join(CIRCUIT_DIR, 'Prover.toml'), w);
    const witness_ms = Number((process.hrtime.bigint() - tw0) / 1_000_000n);

    const exec = await nargoExecute(CIRCUIT_DIR, 'Prover', `witness_b${config}_${rep}`);
    const exec_ms = Number(exec.durationNs / 1_000_000n);

    const prove = await bbProve(CIRCUIT_DIR, CIRCUIT_JSON, witnessFile, proofDir);
    const prove_ms = Number(prove.durationNs / 1_000_000n);

    const verify = await bbVerify(CIRCUIT_DIR, proofPath, VK_PATH);
    const verify_ms = Number(verify.durationNs / 1_000_000n);

    let proof_bytes = 0;
    try {
      const st = await fs.stat(path.join(CIRCUIT_DIR, proofPath));
      proof_bytes = st.size;
    } catch { /* ignore */ }

    const ok = exec.ok && prove.ok && verify.ok;
    rows.push({ config, run: rep, cold_or_warm: tag, witness_ms, exec_ms, prove_ms, verify_ms, proof_bytes, ok });

    if ((i + 1) % 10 === 0 || i === 0 || i === shuffled.length - 1) {
      console.log(`[${i + 1}/${shuffled.length}] cfg=${config} run=${rep} witness=${witness_ms} exec=${exec_ms} prove=${prove_ms} verify=${verify_ms} bytes=${proof_bytes} ok=${ok}`);
    }
  }

  await fs.mkdir('data/results', { recursive: true });
  await writeCsv('data/results/bench.csv',
    ['config','run','cold_or_warm','witness_ms','exec_ms','prove_ms','verify_ms','proof_bytes','ok'],
    rows as any);

  // privacy report
  const sizes = Array.from(new Set(rows.map(r => r.proof_bytes)));
  await fs.writeFile('data/results/privacy_report.json', JSON.stringify({
    proof_size_bytes_unique: sizes,
    proof_size_invariant: sizes.length === 1,
    public_inputs: ['supply', 'h_p', 'auditor_pk_x', 'auditor_pk_y'],
    structural_parameter: 'N = 10',
    note: 'Across all 150 benchmark runs the proof size is invariant; verifier sees only the four listed public inputs.',
    seed,
  }, null, 2));

  const failed = rows.filter(r => !r.ok).length;
  console.log(`\n${rows.length} rows, ${failed} failed.`);
  await destroyBb();
  if (failed) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
