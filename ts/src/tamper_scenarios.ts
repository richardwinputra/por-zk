import { Scenario, USDM_TO_CENTS } from './types.js';

const POLICY_TEST = 'data/case_study/policy_test.json';
const POLICY_9A = 'data/case_study/policy_9a.json';
const SNAPSHOT_ID = 20230306n;
const POLICY_SALT = 0x5a17n;

function usdm(arr: number[]): bigint[] {
  return arr.map(n => BigInt(n) * USDM_TO_CENTS);
}

export function tamperScenarios(): Scenario[] {
  const baseBal = [30,25,25,18,15];
  const baseElig = [1,1,1,1,1];
  const supplyU = 100;
  const mk = (id: string, name: string, expect: boolean, tamper: Scenario['tamper'], opts?: Partial<Scenario>): Scenario => ({
    id, name,
    realCount: 5,
    balancesCents: usdm(baseBal),
    eligibility: baseElig,
    supplyCents: BigInt(supplyU) * USDM_TO_CENTS,
    snapshotId: SNAPSHOT_ID,
    policyJsonPath: POLICY_TEST,
    policySalt: POLICY_SALT,
    expectAccept: expect,
    tamper,
    ...opts,
  });
  return [
    mk('T1', 'Supply changed after signing',    false, { kind: 'supply', delta: 1n }),
    mk('T2', 'Policy salt changed after signing', false, { kind: 'policy_salt', delta: 1n }),
    mk('T3', 'Policy version changed after signing', false, { kind: 'policy_version' }),
    mk('T4', 'Hold + float > balance at slot 1',false, { kind: 'underflow_natural', index: 0 }),
    // T5: padded slot (index 5) gets a non-zero balance with eligibility 0; expected ACCEPT
    {
      id: 'T5',
      name: 'Non-zero balance in padded ineligible slot',
      realCount: 5,
      balancesCents: usdm(baseBal),
      eligibility: baseElig,
      supplyCents: BigInt(supplyU) * USDM_TO_CENTS,
      snapshotId: SNAPSHOT_ID,
      policyJsonPath: POLICY_TEST,
      policySalt: POLICY_SALT,
      expectAccept: true,
      tamper: { kind: 'none' },
      paddedOverride: [{ idx: 5, balanceCents: 999n * USDM_TO_CENTS, eligibility: 0 }],
    },
    mk('T6', 'Eligibility value outside {0,1}', false, { kind: 'boolean_overflow', index: 0, value: 7n }),
    mk('T7', 'Constructed underflow at u64 boundary', false, { kind: 'u64_underflow', index: 0 }),
    mk('T8', 'Stale snapshot replayed under new h_P', false, { kind: 'stale_snapshot', altPolicyJsonPath: POLICY_9A }),
  ];
}
