| Accounts | Proof gen. (ms, median [IQR]) | Verification (ms, median [IQR]) | Execution (ms, median [IQR]) | Witness (ms, median [IQR]) | Proof size (B) |
|---|---|---|---|---|---|
| 1 | 489.4 [29.7] | 35.3 [3.2] | 135.6 [5.2] | 6.0 [0.3] | 15844 |
| 2 | 484.9 [30.4] | 35.1 [1.8] | 135.3 [3.2] | 6.2 [0.3] | 15844 |
| 3 | 492.4 [26.2] | 35.2 [1.8] | 135.6 [5.1] | 6.5 [0.3] | 15844 |
| 4 | 493.5 [24.2] | 35.2 [2.5] | 135.9 [4.2] | 6.7 [0.2] | 15844 |
| 5 | 502.2 [24.7] | 35.3 [3.2] | 134.6 [4.8] | 6.8 [0.1] | 15844 |

Median [interquartile range] over 30 runs per configuration after three complete warmups; IQR uses the 25th and 75th percentiles with linear interpolation. All successful measurements are retained; no outlier trimming. Times include subprocess startup and backend initialization. Capacity is fixed at N=10. Means and sample standard deviations are provided in the CSV summaries.
