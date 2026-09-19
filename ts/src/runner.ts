import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { PROVER_NAME } from './paths.js';

// v0.82.2 selects the ZK flavor only with BOTH options. Share these across all operations.
export const PROOF_FLAGS = ['-s', 'ultra_honk', '--oracle_hash', 'keccak', '--zk'];
export interface RunResult { ok: boolean; stdout: string; stderr: string; durationNs: bigint; }
export function run(cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}): Promise<RunResult> {
  return new Promise(resolve => {
    const start = process.hrtime.bigint();
    const child = spawn(cmd, args, { cwd: opts.cwd, env: opts.env ?? process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => resolve({ ok: code === 0, stdout, stderr, durationNs: process.hrtime.bigint() - start }));
    child.on('error', err => resolve({ ok: false, stdout, stderr: stderr + String(err), durationNs: process.hrtime.bigint() - start }));
  });
}
export function requireSuccess(result: RunResult, operation: string): void {
  if (!result.ok) throw new Error(`${operation} failed:\n${result.stdout}\n${result.stderr}`);
}
export async function nargoExecute(packageDir: string, proverName = PROVER_NAME, witnessName = 'witness'): Promise<RunResult> {
  // Remove stale output: a failed invocation must never reuse a previous witness.
  await fs.rm(path.join(packageDir, 'target', `${witnessName}.gz`), { force: true });
  return run('nargo', ['execute', '--silence-warnings', '-p', proverName, witnessName], { cwd: packageDir });
}
export async function bbProve(packageDir: string, circuitJson: string, witnessFile: string, outDir: string, writeVk = false): Promise<RunResult> {
  await fs.mkdir(path.resolve(packageDir, outDir), { recursive: true });
  await fs.rm(path.resolve(packageDir, outDir, 'proof'), { force: true });
  if (writeVk) await fs.rm(path.resolve(packageDir, outDir, 'vk'), { force: true });
  return run('bb', ['prove', ...PROOF_FLAGS, ...(writeVk ? ['--write_vk'] : []), '-b', circuitJson, '-w', witnessFile, '-o', outDir], { cwd: packageDir });
}
export async function bbVerify(packageDir: string, proofPath: string, vkPath: string): Promise<RunResult> {
  return run('bb', ['verify', ...PROOF_FLAGS, '-p', proofPath, '-k', vkPath], { cwd: packageDir });
}
