# ZK benchmark results

Statistics generated from the recorded ZK experiment.

## Configuration and scope

Barretenberg v0.82.2, Noir 1.0.0-beta.3, `ultra_honk --oracle_hash keccak --zk`. 150 policy runs and 150 baseline runs, five configurations of 30 each, fixed N=10, three discarded warmups per circuit.
Environment: darwin arm64 Apple M1 Pro; Darwin 27.0.0; Node v26.8.1; 16 GB RAM.

## Circuit complexity

Policy: 1,667 ACIR opcodes and 25,576 finalized gates. Baseline: 173 ACIR opcodes and 3,176 finalized gates.
Median forced compilation: policy 161.1 ms; baseline 122.6 ms (five runs each). Gate counts exclude proof-system ZK masking overhead.

## Correctness and verification

22/22 correctness cases; 3/3 separate USDC cases; 15/15 verifier cases passed. Validation CSVs retain their recorded experiment provenance.

## Performance

Policy proving median 491.5 ms (IQR 28.9); verification median 35.2 ms (IQR 2.3); median sum of measured stages 669.5 ms. Proof size: 15,844 bytes in every run.
Per-configuration proving medians range from 484.9 to 502.2 ms.

## Interpretation limits

Both circuits use the same ZK settings. Costs compare the whole policy/attestation layer against an unauthenticated arithmetic baseline; they do not isolate eligibility gating alone. Measurements are wall-clock subprocess times and include process startup/backend initialization. The sum of stages excludes harness cleanup/stat/CSV work. The circuits were measured sequentially on one machine, with randomized configuration order within each circuit. No analysis or tests launched for this experiment overlapped the timed measurements; other machine activity was not instrumented. All runs were retained; no outlier cause is inferred from latency alone. Medians/IQRs are descriptive, not confidence intervals. This is a fixed-N experiment, not a scaling study. Proof-size invariance is not evidence of privacy; the ZK setting supplies that property.

## Correctness

| Scenario group | Tests | Result |
|---|---:|---|
| Solvency (count, eligibility, condition) | 8 | 8/8 Pass |
| Attestation integrity (S1-S6) | 6 | 6/6 Pass |
| Boundary and tamper (T1-T8) | 8 | 8/8 Pass |
| Total | 22 | 22/22 Pass |

## Performance by configuration

| Accounts | Proof gen. (ms, median [IQR]) | Verification (ms, median [IQR]) | Execution (ms, median [IQR]) | Witness (ms, median [IQR]) | Proof size (B) |
|---|---|---|---|---|---|
| 1 | 489.4 [29.7] | 35.3 [3.2] | 135.6 [5.2] | 6.0 [0.3] | 15844 |
| 2 | 484.9 [30.4] | 35.1 [1.8] | 135.3 [3.2] | 6.2 [0.3] | 15844 |
| 3 | 492.4 [26.2] | 35.2 [1.8] | 135.6 [5.1] | 6.5 [0.3] | 15844 |
| 4 | 493.5 [24.2] | 35.2 [2.5] | 135.9 [4.2] | 6.7 [0.2] | 15844 |
| 5 | 502.2 [24.7] | 35.3 [3.2] | 134.6 [4.8] | 6.8 [0.1] | 15844 |

Median [interquartile range] over 30 runs per configuration after three complete warmups; IQR uses the 25th and 75th percentiles with linear interpolation. All successful measurements are retained; no outlier trimming. Times include subprocess startup and backend initialization. Capacity is fixed at N=10. Means and sample standard deviations are provided in the CSV summaries.

## Policy-layer overhead

| Metric | Solvency-only baseline | Policy-bound circuit | Overhead (absolute) | Overhead (×) |
|---|---|---|---|---|
| Gate count (UltraHonk) | 3176 | 25576 | +22400 | 8.05× |
| Proof generation (ms, median) | 124.0 | 491.5 | +367.6 | 3.97× |
| Proof size (B) | 15748 | 15844 | +96 | 1.006× |
| Verification (ms, median) | 33.8 | 35.2 | +1.4 | 1.04× |

Median across 150 repetitions per circuit (5 configurations × 30 repetitions, randomized order). For comparison, the same metrics computed from means: prove 126.9 → 500.1 ms (+373.2, 3.94×), verify 34.4 → 35.7 ms (+1.3, 1.04×). All measurements are retained. The circuits were measured sequentially on one machine, so between-session load/thermal differences may affect the comparison. The proof-size overhead of 96 B equals exactly three additional 32-byte field elements: the policy-bound circuit exposes three Field-typed public inputs ({h_p, auditor_pk_x, auditor_pk_y}) absent from the baseline.

## Illustrative USDC example

| # | Scenario | Eligible (USDm) | Supply (USDm) | Margin (USDm) | Expected | Observed | Result |
|---|---|---|---|---|---|---|---|
| 9a | USDC attested, Mar 6 2023 | 43800 | 43744 | +56 | Accept | Accept | Pass |
| 9b | USDC crisis window, Mar 12 2023 | 37670 | 43744 | -6074 | Reject | Reject | Pass |
| 9c | USDC attested, Mar 31 2023 | 32572 | 32519 | +53 | Accept | Accept | Pass |

Illustrative per-bank allocations, not observed historical bank balances. The March 12 rejection is conditional on the constructed policy scenario.
