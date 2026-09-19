# Policy fixtures

Four policy fixtures used to derive the circuit’s `policy_version` input. Bank allocations and eligibility decisions are illustrative, not historical account observations.

| File | Used by | policy_version source |
|---|---|---|
| `policy_9a.json` | Case study 9a (Mar 6, 2023) | `pedersen_hash(canonical_bytes(policy_9a.json))` |
| `policy_9b.json` | Case study 9b (Mar 12, 2023) | `pedersen_hash(canonical_bytes(policy_9b.json))` |
| `policy_9c.json` | Case study 9c (Mar 31, 2023) | `pedersen_hash(canonical_bytes(policy_9c.json))` |
| `policy_test.json` | All synthetic scenarios (1-8, S1-S6, T1-T8) | `pedersen_hash(canonical_bytes(policy_test.json))` |

The `encodePolicyJson(path)` helper in `ts/src/policy_hash.ts` sorts JSON object keys recursively, serializes values, encodes UTF-8 bytes into 31-byte chunks, converts each chunk to a little-endian field element, and applies Pedersen hashing. The circuit binds this digest but does not interpret the policy rules.

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

## Amounts

`usdc_attested.json` records aggregate-inspired inputs rounded to whole USD millions. Component rounding may differ from rounding the report’s grand total. The executable vectors are in `ts/src/case_study.ts`. They yield eligible reserves/supply of 43,800/43,744, 37,670/43,744, and 32,572/32,519 USD millions, with coverage margins of +56, -6,074, and +53 USD millions. `usdc_illustrative_split.json` documents the synthetic bank allocations.
