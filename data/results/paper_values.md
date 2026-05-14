# Paper substitution values

Source files: bench.csv, bench_baseline.csv, correctness.csv, case_study.csv, paired.csv, circuit_meta.json, circuit_meta_baseline.json, privacy_report.json, run_manifest.json

## §4.1 Circuit complexity
The compiled circuit consists of 1667 ACIR opcodes and 180 Brillig helper opcodes, yielding 25576 UltraHonk gates. Compilation completes in 177 ms (median of 5 runs).

## §4.2 Functional correctness summary
All 22 of 22 scenarios produce the expected outcome: 8/8 solvency, 6/6 attestation integrity, 8/8 boundary and tamper.

## §4.2 Paired governance-effect
Scenario A: effective total 113 USDm, supply 100 USDm, observed Accept.
Scenario B: effective total 80 USDm, supply 100 USDm, observed Reject.

## §4.3 Performance summary
Across all 150 policy-bound runs the proof size is invariant at 14212 B. Median proof generation: 526.5 ms (IQR 39.2); median verification: 42.0 ms (IQR 3.0); median end-to-end (witness + execute + prove + verify): 718.5 ms. For comparison, mean proof generation 535.0 ms and mean verification 43.3 ms.

## §4.3 Measured overhead
Gate count overhead: +22400 gates (8.05×). Proof generation overhead (median): 116.0 → 526.5 ms (+410.5, 4.54×). Proof size overhead: +96 B (1.007×); equals exactly three additional 32-byte field elements (h_p, auditor_pk_x, auditor_pk_y). Verification overhead (median): 40.0 → 42.0 ms (+2.0, 1.05×). Means for the same metrics: prove +407.2 ms (4.19×), verify +2.3 ms (1.06×); the baseline mean is inflated by two warm-run extrinsic interruptions (bench_baseline.csv cfg 2 run 5: prove 680 ms; cfg 3 run 23: prove 295 ms), retained in the dataset.

## §4.4 Case study summary
  - 9a: effective=43800 USDm, supply=43744 USDm, observed=Accept
  - 9b: effective=37670 USDm, supply=43744 USDm, observed=Reject
  - 9c: effective=32572 USDm, supply=32519 USDm, observed=Accept

## Privacy
Public inputs visible to the verifier: supply, h_p, auditor_pk_x, auditor_pk_y. Structural parameter visible: N = 10. Proof size invariant across runs: True.

---

## Table 3 (functional correctness)

| # | Scenario | Expected | Observed | Result |
|---|---|---|---|---|
| 1 | All eligible, surplus | Accept | Accept | Pass |
| 2 | All eligible, exactly solvent | Accept | Accept | Pass |
| 3 | All eligible, insolvent | Reject | Reject | Pass |
| 4 | 3 real accounts | Accept | Accept | Pass |
| 5 | 3 eligible, sufficient | Accept | Accept | Pass |
| 6 | 2 eligible, insufficient | Reject | Reject | Pass |
| 7 | All real accounts ineligible | Reject | Reject | Pass |
| 8 | 1 real account | Accept | Accept | Pass |
| S1 | Valid signature, valid witness | Accept | Accept | Pass |
| S2 | Invalid signature (random bytes) | Reject | Reject | Pass |
| S3 | Balance tampered after signing | Reject | Reject | Pass |
| S4 | Wrong auditor public key | Reject | Reject | Pass |
| S5 | Snapshot ID changed after signing | Reject | Reject | Pass |
| S6 | Eligibility flipped after signing | Reject | Reject | Pass |
| T1 | Supply changed after signing | Reject | Reject | Pass |
| T2 | Policy salt changed after signing | Reject | Reject | Pass |
| T3 | Policy version changed after signing | Reject | Reject | Pass |
| T4 | Hold + float > balance at slot 1 | Reject | Reject | Pass |
| T5 | Non-zero balance in padded ineligible slot | Accept | Accept | Pass |
| T6 | Eligibility value outside {0,1} | Reject | Reject | Pass |
| T7 | Constructed underflow at u64 boundary | Reject | Reject | Pass |
| T8 | Stale snapshot replayed under new h_P | Reject | Reject | Pass |

## Per-config performance breakdown (supplementary)

| Accounts | Proof gen. (ms, median [IQR]) | Verification (ms, median [IQR]) | Execution (ms, median [IQR]) | Witness (ms, median [IQR]) | Proof size (B) |
|---|---|---|---|---|---|
| 1 | 524 [48] | 42.5 [1.8] | 143 [7.2] | 5 [0.8] | 14212 |
| 2 | 515.5 [33.2] | 42.5 [1] | 144 [7] | 5 [1] | 14212 |
| 3 | 544.5 [35.8] | 42 [3.5] | 142 [7.5] | 5 [1] | 14212 |
| 4 | 522 [22.8] | 42 [2] | 142 [8] | 6 [1] | 14212 |
| 5 | 529.5 [35.2] | 42 [3] | 143 [8.8] | 6 [0] | 14212 |

Reported as median [interquartile range] across 30 repetitions per configuration; mean and standard deviation are in `bench_summary.csv` for completeness. Median is reported in the table because two warm runs in `bench_baseline.csv` (cfg 2 run 5; cfg 3 run 23) experienced extrinsic OS-scheduling interruption (`prove_ms` 680 and 295, vs typical ~115); medians are unaffected, the means are inflated by ~7 ms. The outlier rows are retained in the dataset.

## Table 4 (overhead)

| Metric | Solvency-only baseline | Policy-bound circuit | Overhead (absolute) | Overhead (×) |
|---|---|---|---|---|
| Gate count (UltraHonk) | 3176 | 25576 | +22400 | 8.05× |
| Proof generation (ms, median) | 116.0 | 526.5 | +410.5 | 4.54× |
| Proof size (B) | 14116 | 14212 | +96 | 1.007× |
| Verification (ms, median) | 40.0 | 42.0 | +2.0 | 1.05× |

Median across 150 repetitions per circuit (5 configurations × 30 repetitions, randomized order). For comparison, the same metrics computed from means: prove 127.8 → 535.0 ms (+407.2, 4.19×), verify 40.9 → 43.3 ms (+2.3, 1.06×). Both circuits experience occasional extrinsic OS-scheduling outliers that inflate the means; the baseline is more affected proportionally because its typical prove time (~115 ms) is smaller. Outliers retained in the dataset: `bench_baseline.csv` cfg 2 run 5 (prove 680 ms) and cfg 3 run 23 (prove 295 ms); `bench.csv` cfg 3 run 21 (prove 751 ms), cfg 3 run 4 (prove 691 ms), cfg 5 run 18 (prove 664 ms), and cfg 5 run 12 (verify 100 ms). The proof-size overhead of 96 B equals exactly three additional 32-byte field elements: the policy-bound circuit exposes three Field-typed public inputs ({h_p, auditor_pk_x, auditor_pk_y}) absent from the baseline.

## Table 5 (USDC case study)

| # | Scenario | Effective (USDm) | Supply (USDm) | Expected | Observed | Result |
|---|---|---|---|---|---|---|
| 9a | USDC attested, Mar 6 2023 | 43800 | 43744 | Accept | Accept | Pass |
| 9b | USDC crisis window, Mar 12 2023 | 37670 | 43744 | Reject | Reject | Pass |
| 9c | USDC attested, Mar 31 2023 | 32572 | 32519 | Accept | Accept | Pass |
