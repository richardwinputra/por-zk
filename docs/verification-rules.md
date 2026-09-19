# Verification rules and trust boundaries

## What the proof establishes

For the approved compiled circuit and ZK backend, the proof establishes existence of an auditor-signed snapshot whose eligible net reserves cover the public supply. The signed message binds balances, holds, floats, eligibility, policy version, snapshot identifier, supply, domain and circuit identifier. It does not independently determine whether eligibility follows the human-readable policy.

The implementation derives `policy_version` by canonicalizing the policy JSON, encoding its UTF-8 bytes into 31-byte field chunks, and applying Pedersen hash. `h_P` additionally binds the snapshot, supply, flags and salt. A policy document alone cannot reproduce `h_P` without its other inputs.

## Roles and data checks

| Role | Responsibility outside the proof |
|---|---|
| Custodians | Provide authenticated account/position statements, balances, holds and unsettled amounts at the agreed cut-off. |
| Issuer | Assemble the reserve inventory and supply calculation, identify accounts consistently, propose eligibility, and generate the proof after independent attestation. |
| Auditor | Check statement authenticity, ownership/control, reserve encumbrances, valuation/cut-off, unique account/position identity and duplicate inclusion. Reconcile totals and review policy classifications and supply completeness before signing. |
| Supply data process, reviewed by auditor | Identify token contracts and chains, record block heights/timestamps/finality, reconcile mint/burn activity and any excluded or bridged tokens, and align the resulting supply with the reserve snapshot. |
| Registry/configuration operator | Publish authenticated mappings between policy documents, snapshot identifiers, `h_P`, supply, approved auditor keys, circuit/backend versions, verification-key fingerprints and validity/revocation state. |
| Public verifier | Obtain that mapping through an authenticated channel and enforce the checks below, then verify the proof under the approved key. |

These are required deployment responsibilities, not integrations implemented or validated against real banks in this repository. Numeric reserve slots contain no account identifiers, so the circuit cannot detect the same asset appearing in two separately signed slots or being reused in another issuer's statement. Audit procedures and external registries must address those risks. Cross-snapshot reuse is normal and must not be confused with double counting within the same reserve assertion.

## Authenticated acceptance context

`verifyForSnapshot` in `ts/src/verify_snapshot.ts` takes a `TrustedSnapshot`. Obtain it from verifier-controlled configuration or a registry whose signature/channel and authorization have already been verified. Never treat a record supplied only by the prover as trusted.

The mapping contains the snapshot identifier, policy-document digest (`policyVersion`), expected snapshot digest (`policyDigest`, the circuit's `h_P`), supply in cents, approved auditor public-key coordinates, approved verification-key SHA-256, and a validity interval. Deployment must refresh the record for revocations/policy changes and use a trustworthy clock. Signed registries, revocation distribution and chain-supply adapters remain external infrastructure.

The approved verification key must be generated from the reviewed circuit with the pinned ZK configuration. `setup.json` records circuit and key hashes to assist this approval process. Generating a key alone does not approve it. The circuit identifier inside the signed message is not a substitute for the verifier pinning an approved verification key.

## Acceptance procedure

1. Obtain the current authenticated record for the intended issuer and reporting period. Verify registry authenticity/authorization and revocation state externally.
2. Check the record is within its validity interval.
3. Hash the supplied verification key and compare it to the approved fingerprint.
4. Hash the policy document with this implementation's encoding and compare it to the authenticated `policyVersion`.
5. Extract the four application public inputs from the pinned native proof format. Require the supply, `h_P`, and auditor-key coordinates to equal the authenticated record.
6. Verify the proof with the approved key using `-s ultra_honk --oracle_hash keccak --zk` in Barretenberg v0.82.2.
7. Return operational errors separately from invalid proofs. Neither permits acceptance.

The policy/snapshot-to-`h_P` mapping remains a trust assumption because the proof keeps `policy_version` and `snapshot_id` private, so the reference verifier cannot independently read them from a proof. The registry must authenticate their correspondence with the expected digest. A later protocol could expose these identifiers or prove additional relations if public interpretation without that mapping is required.

## Freshness versus cryptographic validity

An unchanged old proof remains valid for its original inputs and key. Including a snapshot identifier in a hash prevents changing that identifier inside an existing attested statement but does not make the proof expire.

In the reference tests, native verification accepts the unchanged proof, while application verification rejects it against a newer record with a different expected digest. Expired/future records are also rejected. This is application-level freshness, not an in-circuit clock or replay nonce.

## Reference implementation boundary

The native parser is specific to the reviewed circuit and Barretenberg v0.82.2. It reads a four-byte vector-length prefix followed by field elements, with the four application inputs first. The verification-key fingerprint pins that layout. Changing the circuit/backend requires re-review of parsing and key approval. The verification tests mutate each actual public-input field and call the native verifier.

The fixtures model an authenticated registry record locally. They do not implement a production registry, authenticate live financial records, prevent auditor collusion, or establish legal/regulatory compliance. Production issuers must not hold the auditor's private key. Production salts must use appropriate randomness. Public deterministic fixtures are only for reproducibility.
