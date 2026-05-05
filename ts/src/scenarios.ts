import { Scenario, USDM_TO_CENTS } from './types.js';

const POLICY_TEST = 'data/case_study/policy_test.json';

function usdm(arr: number[]): bigint[] {
  return arr.map(n => BigInt(n) * USDM_TO_CENTS);
}

const SNAPSHOT_ID = 20230306n;
const POLICY_SALT = 0x5a17n; // arbitrary deterministic salt for synthetic scenarios

export function syntheticScenarios(): Scenario[] {
  const base = (id: string, name: string, balancesUsdm: number[], elig: number[], supplyUsdm: number, expect: boolean): Scenario => ({
    id, name,
    realCount: balancesUsdm.length,
    balancesCents: usdm(balancesUsdm),
    eligibility: elig,
    supplyCents: BigInt(supplyUsdm) * USDM_TO_CENTS,
    snapshotId: SNAPSHOT_ID,
    policyJsonPath: POLICY_TEST,
    policySalt: POLICY_SALT,
    expectAccept: expect,
    tamper: { kind: 'none' },
  });
  return [
    base('1', 'All eligible, surplus',          [30,25,25,18,15], [1,1,1,1,1], 100, true),
    base('2', 'All eligible, exactly solvent',  [20,20,20,20,20], [1,1,1,1,1], 100, true),
    base('3', 'All eligible, insolvent',        [15,15,15,15,15], [1,1,1,1,1], 100, false),
    base('4', '3 real accounts',                [40,35,30,0,0],   [1,1,1,0,0], 100, true),
    base('5', '3 eligible, sufficient',         [30,25,25,18,15], [1,1,1,0,0], 80,  true),
    base('6', '2 eligible, insufficient',       [30,25,25,18,15], [1,1,0,0,0], 90,  false),
    base('7', 'All real accounts ineligible',   [30,30,30,30,30], [0,0,0,0,0], 50,  false),
    base('8', '1 real account',                 [120,0,0,0,0],    [1,0,0,0,0], 100, true),
  ];
}

export function attestationScenarios(): Scenario[] {
  const baseBal = [30,25,25,18,15];
  const baseElig = [1,1,1,1,1];
  const supply = 100;
  const mk = (id: string, name: string, expect: boolean, tamper: Scenario['tamper'], elig = baseElig): Scenario => ({
    id, name,
    realCount: 5,
    balancesCents: usdm(baseBal),
    eligibility: elig,
    supplyCents: BigInt(supply) * USDM_TO_CENTS,
    snapshotId: SNAPSHOT_ID,
    policyJsonPath: POLICY_TEST,
    policySalt: POLICY_SALT,
    expectAccept: expect,
    tamper,
  });
  return [
    mk('S1', 'Valid signature, valid witness',  true,  { kind: 'none' }),
    mk('S2', 'Invalid signature (random bytes)', false, { kind: 'signature' }),
    mk('S3', 'Balance tampered after signing',   false, { kind: 'balance', index: 0, delta: 10n * USDM_TO_CENTS }),
    mk('S4', 'Wrong auditor public key',         false, { kind: 'auditor_key' }),
    mk('S5', 'Snapshot ID changed after signing',false, { kind: 'snapshot_id', delta: 1n }),
    // S6: real eligibility 1,1,0,0,1; flip account index 3 (4th account) from 0->1
    mk('S6', 'Eligibility flipped after signing',false, { kind: 'eligibility', index: 3 }, [1,1,0,0,1]),
  ];
}
