| Metric | Solvency-only baseline | Policy-bound circuit | Overhead (absolute) | Overhead (×) |
|---|---|---|---|---|
| Gate count (UltraHonk) | 3176 | 25576 | +22400 | 8.05× |
| Proof generation (ms, median) | 124.0 | 491.5 | +367.6 | 3.97× |
| Proof size (B) | 15748 | 15844 | +96 | 1.006× |
| Verification (ms, median) | 33.8 | 35.2 | +1.4 | 1.04× |

Median across 150 repetitions per circuit (5 configurations × 30 repetitions, randomized order). For comparison, the same metrics computed from means: prove 126.9 → 500.1 ms (+373.2, 3.94×), verify 34.4 → 35.7 ms (+1.3, 1.04×). All measurements are retained. The circuits were measured sequentially on one machine, so between-session load/thermal differences may affect the comparison. The proof-size overhead of 96 B equals exactly three additional 32-byte field elements: the policy-bound circuit exposes three Field-typed public inputs ({h_p, auditor_pk_x, auditor_pk_y}) absent from the baseline.
