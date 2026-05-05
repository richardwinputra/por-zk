export const N = 10;
export const DOMAIN = 0x504f525f5a4bn; // "POR_ZK"
export const CIRCUIT_ID = 0x01n;
export const USDM_TO_CENTS = 100_000_000n;
export const U64_MAX = (1n << 64n) - 1n;

export type TamperKind =
  | 'none'
  | 'signature'
  | 'balance'
  | 'auditor_key'
  | 'snapshot_id'
  | 'eligibility'
  | 'supply'
  | 'policy_salt'
  | 'policy_version'
  | 'underflow_natural'
  | 'boolean_overflow'
  | 'u64_underflow'
  | 'stale_snapshot';

export interface TamperDirective {
  kind: TamperKind;
  /** index into the slot vector for tampers that need one */
  index?: number;
  /** delta added (in cents) for balance/snapshot/supply tampers */
  delta?: bigint;
  /** alternate value to substitute */
  value?: bigint;
  /** alternate public h_p for stale_snapshot */
  altPolicyJsonPath?: string;
}

export interface Scenario {
  id: string;
  name: string;
  realCount: number;
  /** raw cents per slot, length up to 10 (will be padded with zeros) */
  balancesCents: bigint[];
  holdsCents?: bigint[];
  floatsCents?: bigint[];
  /** length up to 10 (will be padded with 0) */
  eligibility: number[];
  /** raw cents */
  supplyCents: bigint;
  snapshotId: bigint;
  policyJsonPath: string;
  policySalt: bigint;
  expectAccept: boolean;
  tamper?: TamperDirective;
  /** override that lets a scenario set a slot beyond realCount, for T5 */
  paddedOverride?: { idx: number; balanceCents: bigint; eligibility: number }[];
}

export function padArray<T>(arr: T[], len: number, fill: T): T[] {
  const out = arr.slice();
  while (out.length < len) out.push(fill);
  if (out.length > len) throw new Error(`array too long: ${out.length} > ${len}`);
  return out;
}
