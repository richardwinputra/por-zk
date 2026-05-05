import { promises as fs, readFileSync } from 'node:fs';
import * as os from 'node:os';
import * as nodePath from 'node:path';
import { execSync } from 'node:child_process';

function safeExec(cmd: string): string {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
  } catch {
    return '';
  }
}

function readPackageVersion(name: string): string {
  try {
    const p = nodePath.join('ts', 'node_modules', name, 'package.json');
    return JSON.parse(readFileSync(p, 'utf8')).version;
  } catch (e) {
    return '';
  }
}

async function main() {
  const args = process.argv.slice(2);
  const seedArg = args.find(a => a.startsWith('--seed='));
  const seed = seedArg ? Number(seedArg.split('=')[1]) : Math.floor(Math.random() * 1e9);

  const manifest = {
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
  await fs.mkdir('data/results', { recursive: true });
  await fs.writeFile('data/results/run_manifest.json', JSON.stringify(manifest, null, 2));
  console.log('manifest written:', manifest);
}

main().catch(e => { console.error(e); process.exitCode = 1; });
