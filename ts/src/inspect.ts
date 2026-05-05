import { Barretenberg, Fr } from '@aztec/bb.js';
import { writeFileSync } from 'node:fs';

const bb = await Barretenberg.new({});
const sk = Fr.fromString('0x000000000000000000000000000000000000000000000000000000000000abcd');
const pk = await bb.schnorrComputePublicKey(sk);
const msg = new Uint8Array(32);
for (let i = 0; i < 32; i++) msg[i] = i;
const [s, e] = await bb.schnorrConstructSignature(msg, sk);
const sig = new Uint8Array(64);
sig.set(s.toBuffer(), 0);
sig.set(e.toBuffer(), 32);

// Write Prover.toml
const lines = [
  `pk_x = "${pk.x.toString()}"`,
  `pk_y = "${pk.y.toString()}"`,
  `sig = [${Array.from(sig).map(b => `"${b}"`).join(', ')}]`,
  `msg = [${Array.from(msg).map(b => `"${b}"`).join(', ')}]`,
  '',
];
writeFileSync('/tmp/nrtest2/Prover.toml', lines.join('\n'));
console.log('written /tmp/nrtest2/Prover.toml');
await bb.destroy();
