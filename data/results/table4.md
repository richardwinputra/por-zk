| Metric | Solvency-only baseline | Policy-bound circuit | Overhead (absolute) | Overhead (×) |
|---|---|---|---|---|
| Gate count (UltraHonk) | 3176 | 25576 | +22400 | 8.05× |
| Proof generation (ms, median) | 116.0 | 526.5 | +410.5 | 4.54× |
| Proof size (B) | 14116 | 14212 | +96 | 1.007× |
| Verification (ms, median) | 40.0 | 42.0 | +2.0 | 1.05× |

Median across 150 repetitions per circuit (5 configurations × 30 repetitions, randomized order). For comparison, the same metrics computed from means: prove 127.8 → 535.0 ms (+407.2, 4.19×), verify 40.9 → 43.3 ms (+2.3, 1.06×). Both circuits experience occasional extrinsic OS-scheduling outliers that inflate the means; the baseline is more affected proportionally because its typical prove time (~115 ms) is smaller. Outliers retained in the dataset: `bench_baseline.csv` cfg 2 run 5 (prove 680 ms) and cfg 3 run 23 (prove 295 ms); `bench.csv` cfg 3 run 21 (prove 751 ms), cfg 3 run 4 (prove 691 ms), cfg 5 run 18 (prove 664 ms), and cfg 5 run 12 (verify 100 ms). The proof-size overhead of 96 B equals exactly three additional 32-byte field elements: the policy-bound circuit exposes three Field-typed public inputs ({h_p, auditor_pk_x, auditor_pk_y}) absent from the baseline.
