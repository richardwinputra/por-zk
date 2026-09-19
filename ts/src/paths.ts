import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

// Works from src/ and compiled dist/, independent of the invocation directory.
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const repoPath = (...parts: string[]) => path.resolve(ROOT, ...parts);
export const RESULTS_DIR = repoPath(process.env.POR_RESULTS_DIR ?? 'data/runs/validation');
const saved = repoPath('data/results');
const archive = repoPath('OLD');
if ([saved, archive].some(dir => RESULTS_DIR === dir || RESULTS_DIR.startsWith(dir + path.sep))) {
  throw new Error('Recorded results are read-only. Choose a fresh POR_RESULTS_DIR under data/runs.');
}
export const resultPath = (name: string) => path.join(RESULTS_DIR, name);
export const PROVER_NAME = 'RunProver';
export const VK_PATH = path.join('target', 'vk-zk', 'vk');
