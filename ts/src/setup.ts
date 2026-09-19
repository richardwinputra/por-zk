import { promises as fs } from 'node:fs';
import { createHash } from 'node:crypto';
import { repoPath, RESULTS_DIR, resultPath } from './paths.js';
import { run, bbProve, nargoExecute, requireSuccess, PROOF_FLAGS } from './runner.js';

async function main() {
  const versions: Record<string, string> = {};
  for (const [tool, expected] of [['nargo', '1.0.0-beta.3'], ['bb', '0.82.2']]) {
    const r = await run(tool, ['--version']); requireSuccess(r, `${tool} version`);
    versions[tool] = r.stdout.trim();
    const version = versions[tool].match(/(?:version = |^v?)(\d+\.\d+\.\d+(?:-beta\.\d+)?)/)?.[1];
    if (version !== expected) throw new Error(`Expected ${tool} ${expected}, received ${versions[tool]}`);
  }
  const artifacts = [];
  for (const name of ['circuit', 'circuit_baseline']) {
    const cwd = repoPath(name);
    requireSuccess(await run('nargo', ['compile'], { cwd }), `Compile ${name}`);
    // v0.82.2 write_vk does not expose --zk: generate the VK with the ZK proof.
    requireSuccess(await nargoExecute(cwd, 'Prover', 'witness_setup'), `Setup witness ${name}`);
    requireSuccess(await bbProve(cwd, `target/${name}.json`, 'target/witness_setup.gz', 'target/vk-zk', true), `ZK key ${name}`);
    const digest = async (p: string) => createHash('sha256').update(await fs.readFile(p)).digest('hex');
    artifacts.push({ circuit: name, circuit_sha256: await digest(repoPath(name, 'target', `${name}.json`)), vk_sha256: await digest(repoPath(name, 'target/vk-zk/vk')) });
    console.log(`${name}: compiled and ZK verification key generated`);
  }
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.writeFile(resultPath('setup.json'), JSON.stringify({ versions, proof_flags: PROOF_FLAGS, artifacts }, null, 2) + '\n');
}
main().catch(e => { console.error(e); process.exitCode = 1; });
