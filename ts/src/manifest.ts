import { ROOT, RESULTS_DIR, resultPath, repoPath } from './paths.js';
import { promises as fs, readFileSync } from 'node:fs';
import * as os from 'node:os';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  } catch {
    return '';
  }
}

function readPackageVersion(name: string): string {
  try {
    const p = repoPath('ts', 'node_modules', name, 'package.json');
    return JSON.parse(readFileSync(p, 'utf8')).version;
  } catch (e) {
    return '';
  }
}

async function sourceHashes(): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  const walk = async (rel: string) => {
    for (const item of await fs.readdir(repoPath(rel), { withFileTypes: true })) {
      const child = `${rel}/${item.name}`;
      if (item.name === '__pycache__') continue;
      if (item.isDirectory()) await walk(child);
      else hashes[child] = createHash('sha256').update(await fs.readFile(repoPath(child))).digest('hex');
    }
  };
  await walk('ts/src');
  await walk('analysis');
  for (const rel of ['ts/package.json', 'ts/pnpm-lock.yaml', 'circuit/src/main.nr', 'circuit_baseline/src/main.nr']) {
    hashes[rel] = createHash('sha256').update(await fs.readFile(repoPath(rel))).digest('hex');
  }
  return hashes;
}

async function main() {
  const args = process.argv.slice(2);
  const seedArg = args.find(a => a.startsWith('--seed='));
  const seed = seedArg ? Number(seedArg.split('=')[1]) : 4242;

  const manifest = {
    scope: 'Environment/configuration record; file presence alone does not attest completion of any benchmark',
    source_sha256: await sourceHashes(),
    proof_configuration: { scheme: 'ultra_honk', oracle_hash: 'keccak', zk: true, flags: ['-s', 'ultra_honk', '--oracle_hash', 'keccak', '--zk'] },
    nargo_version: (safeExec('nargo --version').match(/\d+\.\d+\.\d+\S*/) ?? [''])[0],
    bb_version: safeExec('bb --version'),
    bbjs_version: readPackageVersion('@aztec/bb.js'),
    noirc_abi_version: readPackageVersion('@noir-lang/noirc_abi'),
    node_version: process.version,
    python_version: safeExec('python3 --version'),
    git_commit: safeExec('git rev-parse HEAD') || 'no-git',
    git_dirty: !!safeExec('git status --porcelain'),
    machine: `${os.platform()} ${os.arch()} ${os.cpus()[0]?.model ?? 'unknown'}`,
    os_release: os.release(),
    cpu_count: os.cpus().length,
    memory_gb: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
    utc_timestamp: new Date().toISOString(),
    bench_seed: seed,
  };
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.writeFile(resultPath('run_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('manifest written:', manifest);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
