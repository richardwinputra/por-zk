import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export interface RunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  durationNs: bigint;
}

export function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<RunResult> {
  return new Promise(resolve => {
    const start = process.hrtime.bigint();
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => {
      const durationNs = process.hrtime.bigint() - start;
      resolve({ ok: code === 0, stdout, stderr, durationNs });
    });
    child.on('error', err => {
      const durationNs = process.hrtime.bigint() - start;
      resolve({ ok: false, stdout, stderr: stderr + String(err), durationNs });
    });
  });
}

export async function nargoExecute(packageDir: string, proverName = 'Prover', witnessName = 'witness'): Promise<RunResult> {
  return await run('nargo', ['execute', '--silence-warnings', '-p', proverName, witnessName], { cwd: packageDir });
}

export async function bbProve(packageDir: string, circuitJson: string, witnessFile: string, outDir: string): Promise<RunResult> {
  await fs.mkdir(path.join(packageDir, outDir), { recursive: true });
  return await run('bb', ['prove', '-s', 'ultra_honk', '-b', circuitJson, '-w', witnessFile, '-o', outDir], { cwd: packageDir });
}

export async function bbVerify(packageDir: string, proofPath: string, vkPath: string): Promise<RunResult> {
  return await run('bb', ['verify', '-s', 'ultra_honk', '-p', proofPath, '-k', vkPath], { cwd: packageDir });
}
