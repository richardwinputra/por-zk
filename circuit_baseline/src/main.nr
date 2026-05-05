global N: u32 = 10;

fn main(
    supply: pub u64,
    balances: [u64; 10],
    holds: [u64; 10],
    floats: [u64; 10],
) {
    let mut sum: u128 = 0;
    for i in 0..10 {
        let b = balances[i];
        let h = holds[i];
        let f = floats[i];
        assert(b >= h);
        let tmp = b - h;
        assert(tmp >= f);
        let net = tmp - f;
        sum = sum + (net as u128);
    }
    assert(sum >= supply as u128);
}
