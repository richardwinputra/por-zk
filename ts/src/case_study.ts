import { Scenario, USDM_TO_CENTS } from './types.js';

const POLICY_9A = 'data/case_study/policy_9a.json';
const POLICY_9B = 'data/case_study/policy_9b.json';
const POLICY_9C = 'data/case_study/policy_9c.json';

function usdm(arr: number[]): bigint[] {
  return arr.map(n => BigInt(n) * USDM_TO_CENTS);
}

export function caseStudyScenarios(): Scenario[] {
  return [
    {
      id: '9a',
      name: 'USDC attested, Mar 6 2023',
      realCount: 8,
      balancesCents: usdm([32366, 3500, 1100, 304, 400, 2130, 3300, 700, 0, 0]),
      eligibility:           [1,1,1,1,1,1,1,1,0,0],
      supplyCents: 43744n * USDM_TO_CENTS,
      snapshotId: 20230306n,
      policyJsonPath: POLICY_9A,
      policySalt: 0xA1n,
      expectAccept: true,
      tamper: { kind: 'none' },
    },
    {
      id: '9b',
      name: 'USDC crisis window, Mar 12 2023',
      realCount: 8,
      balancesCents: usdm([32366, 3500, 1100, 304, 400, 2130, 3300, 700, 0, 0]),
      eligibility:           [1,1,1,1,1,0,0,0,0,0],
      supplyCents: 43744n * USDM_TO_CENTS,
      snapshotId: 20230312n,
      policyJsonPath: POLICY_9B,
      policySalt: 0xB1n,
      expectAccept: false,
      tamper: { kind: 'none' },
    },
    {
      id: '9c',
      name: 'USDC attested, Mar 31 2023',
      realCount: 4,
      balancesCents: usdm([28886, 2200, 900, 0, 0, 0, 0, 0, 586, 0]),
      eligibility:           [1,1,1,0,0,0,0,0,1,0],
      supplyCents: 32519n * USDM_TO_CENTS,
      snapshotId: 20230331n,
      policyJsonPath: POLICY_9C,
      policySalt: 0xC1n,
      expectAccept: true,
      tamper: { kind: 'none' },
    },
  ];
}
