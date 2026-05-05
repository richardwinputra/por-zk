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
