# Policy drafts

Four policy documents that the implementation will hash to produce the `policy_version` field input for the policy-bound circuit (see implementation_plan.md §4.8).

| File | Used by | policy_version source |
|---|---|---|
| `policy_9a.json` | Case study 9a (Mar 6, 2023) | `pedersen_hash(canonical_bytes(policy_9a.json))` |
| `policy_9b.json` | Case study 9b (Mar 12, 2023) | `pedersen_hash(canonical_bytes(policy_9b.json))` |
| `policy_9c.json` | Case study 9c (Mar 31, 2023) | `pedersen_hash(canonical_bytes(policy_9c.json))` |
| `policy_test.json` | All synthetic scenarios (1-8, S1-S6, T1-T8) | `pedersen_hash(canonical_bytes(policy_test.json))` |

When the `por-zk` project is created, copy this folder to `por-zk/data/case_study/`. The TS helper `encodePolicyJson(path)` performs JCS canonicalization (RFC 8785), UTF-8 encoding, 31-byte chunking, little-endian field conversion, and Pedersen hashing.

## Slot map

The slot indices in the four policy documents are stable across snapshots so that an unchanged custodian retains the same slot identity through the timeline.

| Slot | Custodian |
|---|---|
| 0 | Circle Reserve Fund (government MMF) |
| 1 | Bank of New York Mellon |
| 2 | Customers Bank |
| 3 | Citizens Trust Bank |
| 4 | New York Community Bank |
| 5 | Silvergate Bank |
| 6 | Silicon Valley Bank |
| 7 | Signature Bank |
| 8 | Cross River Bank (post-crisis) |
| 9 | unused padding |

Slots 1-7 are the seven cash custodians named in the Deloitte-attested March 6, 2023 Circle USDC Reserve Report. Slot 8 holds the post-crisis banking partner that appears in the March 31, 2023 attestation. Slot 9 is permanent padding to keep the slot count fixed at N = 10.
