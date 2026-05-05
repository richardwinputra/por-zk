| Accounts | Proof gen. (ms, median [IQR]) | Verification (ms, median [IQR]) | Execution (ms, median [IQR]) | Witness (ms, median [IQR]) | Proof size (B) |
|---|---|---|---|---|---|
| 1 | 524 [48] | 42.5 [1.8] | 143 [7.2] | 5 [0.8] | 14212 |
| 2 | 515.5 [33.2] | 42.5 [1] | 144 [7] | 5 [1] | 14212 |
| 3 | 544.5 [35.8] | 42 [3.5] | 142 [7.5] | 5 [1] | 14212 |
| 4 | 522 [22.8] | 42 [2] | 142 [8] | 6 [1] | 14212 |
| 5 | 529.5 [35.2] | 42 [3] | 143 [8.8] | 6 [0] | 14212 |

Reported as median [interquartile range] across 30 repetitions per configuration; mean and standard deviation are in `bench_summary.csv` for completeness. Median is reported in the table because two warm runs in `bench_baseline.csv` (cfg 2 run 5; cfg 3 run 23) experienced extrinsic OS-scheduling interruption (`prove_ms` 680 and 295, vs typical ~115); medians are unaffected, the means are inflated by ~7 ms. The outlier rows are retained in the dataset.
