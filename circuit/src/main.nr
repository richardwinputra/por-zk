use std::embedded_curve_ops::EmbeddedCurvePoint;
use std::hash::pedersen_hash;
use schnorr;

global N: u32 = 10;
global DOMAIN: Field = 0x504f525f5a4b; // ASCII "POR_ZK"
global CIRCUIT_ID: Field = 0x01;

fn main(
    supply: pub u64,
    h_p: pub Field,
    auditor_pk_x: pub Field,
    auditor_pk_y: pub Field,
    balances: [u64; 10],
    holds: [u64; 10],
    floats: [u64; 10],
    eligibility: [u1; 10],
    snapshot_id: u64,
    policy_version: Field,
    policy_salt: Field,
    signature: [u8; 64],
) {
    let mut eff_sum: u128 = 0;
    for i in 0..10 {
        let b = balances[i];
        let h = holds[i];
        let f = floats[i];
        assert(b >= h);
        let tmp = b - h;
        assert(tmp >= f);
        let net = tmp - f;
        let elig = eligibility[i] as u64;
        eff_sum = eff_sum + (net as u128) * (elig as u128);
    }
    assert(eff_sum >= supply as u128);

    let mut witness_fields: [Field; 30] = [0; 30];
    for i in 0..10 {
        witness_fields[3 * i] = balances[i] as Field;
        witness_fields[3 * i + 1] = holds[i] as Field;
        witness_fields[3 * i + 2] = floats[i] as Field;
    }
    let h_w = pedersen_hash(witness_fields);

    let mut policy_fields: [Field; 14] = [0; 14];
    policy_fields[0] = policy_version;
    policy_fields[1] = snapshot_id as Field;
    policy_fields[2] = supply as Field;
    for i in 0..10 {
        policy_fields[3 + i] = eligibility[i] as Field;
    }
    policy_fields[13] = policy_salt;
    let h_p_computed = pedersen_hash(policy_fields);
    assert(h_p_computed == h_p);

    let m = pedersen_hash([
        DOMAIN,
        CIRCUIT_ID,
        snapshot_id as Field,
        supply as Field,
        h_p,
        h_w,
    ]);
    let m_bytes: [u8; 32] = m.to_be_bytes();

    let auditor_pk = EmbeddedCurvePoint { x: auditor_pk_x, y: auditor_pk_y, is_infinite: false };
    let ok = schnorr::verify_signature(auditor_pk, signature, m_bytes);
    assert(ok);
}
