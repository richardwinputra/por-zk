import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { writeBaselineProverToml } from './witness.js';
import { destroyBb } from './pedersen.js';
import { USDM_TO_CENTS, padArray } from './types.js';
import { nargoExecute, bbProve, bbVerify } from './runner.js';
import { writeCsv } from './csv.js';

const ROOT = path.resolve(process.cwd());
const BASE_DIR = path.join(ROOT, 'circuit_baseline');
const CIRCUIT_JSON = path.join('target', 'circuit_baseline.json');
const VK_PATH = path.join('target', 'vk', 'vk');

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
  try {
    const m = JSON.parse(await fs.readFile('data/results/run_manifest.json', 'utf8'));
    return Number(m.bench_seed) ^ 0x5b5b5b;
  } catch {
    return 2;
  }
}

async function main() {
  const seed = await readSeed();
  const rand = mulberry32(seed);

  const schedule: Array<{ config: number; run: number }> = [];
  for (const c of CONFIGS) for (let r = 0; r < REPS; r++) schedule.push({ config: c, run: r });
  const shuffled = shuffle(schedule, rand);

  console.log('warm-up x3...');
  const warmBalances = padArray<bigint>([20n, 20n, 20n].map(n => n * USDM_TO_CENTS), 10, 0n);
  await writeBaselineProverToml(path.join(BASE_DIR, 'Prover.toml'), 60n * USDM_TO_CENTS, warmBalances, [], []);
  for (let i = 0; i < 3; i++) {
    await nargoExecute(BASE_DIR, 'Prover', 'witness_warm');
    await bbProve(BASE_DIR, CIRCUIT_JSON, path.join('target', 'witness_warm.gz'), path.join('target', 'proof_warm'));
  }

  const rows: any[] = [];
  let coldUsed = false;
  for (let i = 0; i < shuffled.length; i++) {
    const { config, run: rep } = shuffled[i];
    const tag: 'cold' | 'warm' = !coldUsed ? 'cold' : 'warm';
    coldUsed = true;
    const balances = padArray<bigint>(
      Array(config).fill(0).map(() => 20n * USDM_TO_CENTS),
      10, 0n,
    );
    const supply = BigInt(config * 20) * USDM_TO_CENTS;
    const witnessFile = path.join('target', `witness_b${config}_${rep}.gz`);
    const proofDir = path.join('target', `proof_b${config}_${rep}`);
    const proofPath = path.join(proofDir, 'proof');

    const tw0 = process.hrtime.bigint();
    await writeBaselineProverToml(path.join(BASE_DIR, 'Prover.toml'), supply, balances, [], []);
    const witness_ms = Number((process.hrtime.bigint() - tw0) / 1_000_000n);

    const exec = await nargoExecute(BASE_DIR, 'Prover', `witness_b${config}_${rep}`);
    const exec_ms = Number(exec.durationNs / 1_000_000n);

    const prove = await bbProve(BASE_DIR, CIRCUIT_JSON, witnessFile, proofDir);
    const prove_ms = Number(prove.durationNs / 1_000_000n);

    const verify = await bbVerify(BASE_DIR, proofPath, VK_PATH);
    const verify_ms = Number(verify.durationNs / 1_000_000n);

    let proof_bytes = 0;
    try {
      const st = await fs.stat(path.join(BASE_DIR, proofPath));
      proof_bytes = st.size;
    } catch { /* ignore */ }

    const ok = exec.ok && prove.ok && verify.ok;
    rows.push({ config, run: rep, cold_or_warm: tag, witness_ms, exec_ms, prove_ms, verify_ms, proof_bytes, ok });

    if ((i + 1) % 10 === 0 || i === 0 || i === shuffled.length - 1) {
      console.log(`[${i + 1}/${shuffled.length}] cfg=${config} run=${rep} witness=${witness_ms} exec=${exec_ms} prove=${prove_ms} verify=${verify_ms} bytes=${proof_bytes} ok=${ok}`);
    }
  }

  await fs.mkdir('data/results', { recursive: true });
  await writeCsv('data/results/bench_baseline.csv',
    ['config','run','cold_or_warm','witness_ms','exec_ms','prove_ms','verify_ms','proof_bytes','ok'],
    rows);

  const failed = rows.filter(r => !r.ok).length;
  console.log(`\n${rows.length} rows, ${failed} failed.`);
  await destroyBb();
  if (failed) process.exitCode = 1;
}

main().catch(e => { console.error(e); process.exitCode = 1; });
