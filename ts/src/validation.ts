import type { Scenario } from './types.js';

export type RejectionReason = 'solvency' | 'underflow' | 'policy_hash' | 'signature' | 'boolean';
// Classify evidence, never the scenario's requested tamper. Unrecognized errors are operational failures.
export function classifyFailure(stage: string, diagnostic: string): RejectionReason | 'operational_error' {
  if (stage !== 'execute') return 'operational_error';
  if (/eligibility\[\d+\]/.test(diagnostic) && /does not fall within range/.test(diagnostic) && /width: 1/.test(diagnostic)) return 'boolean';
  if (!diagnostic.includes('Failed constraint')) return 'operational_error';
  if (diagnostic.includes('assert(eff_sum >= supply as u128)')) return 'solvency';
  if (diagnostic.includes('assert(b >= h)') || diagnostic.includes('assert(tmp >= f)')) return 'underflow';
  if (diagnostic.includes('assert(h_p_computed == h_p)')) return 'policy_hash';
  if (diagnostic.includes('assert(ok)')) return 'signature';
  return 'operational_error';
}
export function expectedRejection(s: Scenario): RejectionReason | undefined {
  if (s.expectAccept) return undefined;
  switch (s.tamper?.kind ?? 'none') {
    case 'none': return 'solvency';
    case 'signature': case 'balance': case 'auditor_key': return 'signature';
    case 'snapshot_id': case 'eligibility': case 'supply': case 'policy_salt': case 'policy_version': case 'stale_snapshot': return 'policy_hash';
    case 'underflow_natural': case 'u64_underflow': return 'underflow';
    case 'boolean_overflow': return 'boolean';
  }
}
export function matchesExpectedRejection(s: Scenario, stage: string, diagnostic: string): boolean {
  const expected = expectedRejection(s);
  return expected !== undefined && classifyFailure(stage, diagnostic) === expected;
}
