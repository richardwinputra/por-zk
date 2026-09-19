# Policy-Bound Proof of Reserve

Code, fixtures, and experimental results for **Policy-Bound Zero-Knowledge Proof of Reserve for Stablecoin Solvency Verification**.

The Noir circuit verifies an auditor-signed eligibility vector and proves that eligible net reserves cover the asserted supply. It binds the reserve data, policy-related snapshot digest, and auditor signature. Policy interpretation, account authenticity, duplicate detection, and supply completeness require external checks. See [verification rules](docs/verification-rules.md).

## Contents

| Directory | Purpose |
|---|---|
| `circuit/` | Policy-bound circuit with auditor-signature verification |
| `circuit_baseline/` | Solvency-only comparison circuit used in Table 3 |
| `ts/src/` | Witness construction, setup, validation, benchmark runners, and application verifier |
| `analysis/` | Statistics, manuscript tables, Figure 2, and consistency checks |
| `data/case_study/` | Policy and illustrative reserve fixtures |
| `data/results/benchmarks/` | The 300 recorded measurements and manuscript exports |
| `data/results/validation/` | Recorded correctness and verification evidence |
| `data/provenance/` | Measurement-source fingerprints and compiled-circuit fingerprints |

Both circuits are part of the same experiment. Generated files go into `target/`, `ts/dist/`, or `data/runs/`. These and the local `OLD/` archive are excluded from version control.

## Software and environment

- Noir / nargo `1.0.0-beta.3`
- Barretenberg (`bb`) and `@aztec/bb.js` `0.82.2`
- `noir-lang/schnorr` `v0.1.3`
- Node.js `26.8.1`
- JavaScript dependencies pinned in `ts/pnpm-lock.yaml`
- Analysis packages pinned in `requirements-analysis.txt`

The recorded measurements used an Apple M1 Pro, 8 ARM64 cores, 16 GB RAM, and Darwin 27.0.0. The measurement manifest and `analysis_runtime.json` record the environment. Install the pinned native executables on PATH before running setup. Setup checks their versions. A tsx `module.register` deprecation warning on Node 26.8.1 does not indicate a failed test.

## Build and validate

Run these commands sequentially from the repository root. Scenario runners share a generated witness file per circuit.

```bash
pnpm --dir ts install --frozen-lockfile --ignore-scripts
npm --prefix ts run build
npm --prefix ts test
export POR_RESULTS_DIR=data/runs/validation
npm --prefix ts run setup
npm --prefix ts run smoke
npm --prefix ts run correctness
npm --prefix ts run paired
npm --prefix ts run case_study
npm --prefix ts run verification
npm --prefix ts run manifest -- --seed=4242
```

Setup compiles both circuits, executes their example witnesses, and generates matching ZK proofs and verification keys. Smoke tests verify both proofs. Keys are generated at `circuit/target/vk-zk/vk` and `circuit_baseline/target/vk-zk/vk`. The committed `Prover.toml` files are example inputs. Runs write separate `RunProver.toml` files.

The recorded validation contains 22 correctness scenarios, two paired eligibility examples, three illustrative USDC scenarios, and 15 native/application verification cases. Rejection tests pass only when diagnostics match the expected failure. Missing tools, crashes, and wrong keys cannot count as a successful expected rejection.

## Exact proof configuration

This experiment uses **UltraKeccakZKFlavor**, selected in Barretenberg v0.82.2 by both `--oracle_hash keccak` and `--zk`.

```text
-s ultra_honk --oracle_hash keccak --zk
```

The standalone `bb write_vk` command in this version does not accept `--zk`. Generate the matching key with `prove --write_vk`. For example, from `circuit/`:

```bash
nargo compile
nargo execute --silence-warnings -p Prover witness_setup
mkdir -p target/vk-zk
bb prove -s ultra_honk --oracle_hash keccak --zk --write_vk \
  -b target/circuit.json -w target/witness_setup.gz -o target/vk-zk
bb verify -s ultra_honk --oracle_hash keccak --zk \
  -p target/vk-zk/proof -k target/vk-zk/vk
```

Setup performs the equivalent commands for the baseline. Proof generation and verification must use matching backend settings and keys. These commands are specific to the pinned version.

## Recorded results

All 150 policy-circuit proofs and 150 baseline proofs verified.

| Metric | Policy circuit | Solvency baseline |
|---|---:|---:|
| Proving median (ms) | 491.5 | 124.0 |
| Proving IQR (ms) | 28.9 | 8.6 |
| Verification median (ms) | 35.2 | 33.8 |
| Serialized proof bytes | 15,844 | 15,748 |
| Finalized gates | 25,576 | 3,176 |

The comparison measures the combined cost of eligibility gating, digest computation, and signature verification. Most of the measured overhead is in proving. Verification and serialized proof size increase by about 4% and 0.6%, respectively.

Each circuit has five configurations with 1–5 active accounts and fixed capacity `N=10`, 30 repetitions per configuration, and three discarded warmups. Timings include subprocess startup and backend initialization. Configurations are randomized within each circuit batch. Circuit batches run sequentially. All measurements are retained. This experiment describes a fixed-capacity workload and does not establish scalability or production throughput.

[Paper values](data/results/benchmarks/paper_values.md) collect the statistics. The exported [Table 2](data/results/benchmarks/table2.md), [Table 3](data/results/benchmarks/table3.md), [Table 4](data/results/benchmarks/table4.md), and [Figure 2](data/results/benchmarks/figure2.pdf) correspond to the manuscript. [Per-configuration statistics](data/results/benchmarks/performance_by_config.md) supplement Figure 2. The [consistency report](data/results/benchmarks/analysis_validation.json) records the independent numerical checks.

## Reproduce the analysis

Install the analysis dependencies in a Python environment, then run the five commands below. Setup must have generated the compiled circuits and keys before the last command.

```bash
python3 -m pip install -r requirements-analysis.txt
export POR_RESULTS_DIR=data/results/benchmarks
export POR_VALIDATION_DIR=data/results/validation
export MPLCONFIGDIR=/tmp/por-zk-matplotlib
python3 analysis/summarize.py
python3 analysis/overhead_measured.py
python3 analysis/plot_bench.py
python3 analysis/paper_export.py
python3 analysis/check_consistency.py
```

The checker independently recalculates medians, inclusive quartiles, and other summary statistics. It checks the recorded input hashes, copied validation evidence, source fingerprints, compiled circuits, and exact verification-key hashes. Compiled-circuit comparison ignores only diagnostic `file_map.path` values when the checkout location changes. Bytecode, ABI, embedded source text, and other fields remain checked.

`data/provenance/measurement-sources.zip` preserves the exact source files recorded by the measurement manifest. `source-index.json` records the active implementation and the measurement inputs separately, so packaging or analysis changes do not rewrite the provenance of the recorded timings. This source archive is evidence for the reported experiment. Error diagnostics in the validation CSVs use repository-relative paths for portability. Fingerprints detect inconsistency but are not a signed supply-chain attestation.

## Collect a new experiment

Choose a fresh directory. The benchmark runners refuse to overwrite existing raw CSVs. Run without concurrent tests or analysis.

```bash
export POR_RESULTS_DIR=data/runs/experiment
export POR_VALIDATION_DIR="$POR_RESULTS_DIR"
npm --prefix ts run setup
npm --prefix ts run smoke
npm --prefix ts run correctness
npm --prefix ts run paired
npm --prefix ts run case_study
npm --prefix ts run verification
npm --prefix ts run meta
npm --prefix ts run manifest -- --seed=4242
npm --prefix ts run bench
npm --prefix ts run bench_baseline
python3 analysis/record_validation.py
```

Then run the five analysis commands above, keeping these directory variables. A new experiment records fresh validation evidence and timing measurements. Native runners cannot write into `data/results/`, which holds the paper's recorded experiment.

## Data and trust limits

Per-bank allocations and eligibility decisions are illustrative. The case-study fixtures use aggregate-inspired amounts rounded to USD millions. They are not exact historical bank balances. The fixture coverage margins are USD +56M, −6,074M, and +53M for scenarios 9a, 9b, and 9c.

`data/auditor_key.json` is a deterministic test key derived from `0xabcd`. It and the policy salts are public fixtures. In deployment, the issuer must not possess the auditor's signing key, and salts need appropriate randomness. Fixed-size proofs alone do not demonstrate zero knowledge.

The reference verifier checks trusted snapshot context and the proof. Registry authentication, revocation distribution, live bank/chain integrations, and correct policy classifications are external responsibilities. Neither the tests nor a valid proof establish those real-world facts.

## License

[MIT](LICENSE).
