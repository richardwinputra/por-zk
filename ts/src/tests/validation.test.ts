import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFailure, matchesExpectedRejection } from '../validation.js';
import { attestationScenarios } from '../scenarios.js';
import { USDM_TO_CENTS } from '../types.js';
test('S6 stays solvent on both sides of eligibility tampering', () => {
  const s = attestationScenarios().find(s => s.id === 'S6')!;
  const sum = (e: number[]) => s.balancesCents.reduce((t, b, i) => t + b * BigInt(e[i]), 0n);
  const tampered = s.eligibility.slice(); tampered[s.tamper!.index!] = 1;
  assert.equal(sum(s.eligibility), 70n * USDM_TO_CENTS);
  assert.equal(sum(tampered), 88n * USDM_TO_CENTS);
  assert.ok(sum(s.eligibility) >= s.supplyCents && sum(tampered) >= s.supplyCents);
});
test('negative tests reject wrong constraints and operational failures', () => {
  const s = attestationScenarios().find(s => s.id === 'S6')!;
  for (const message of ['spawn nargo ENOENT', 'cannot find Nargo.toml', 'Failed to open proof', 'Failed constraint\nassert(eff_sum >= supply as u128);']) {
    assert.equal(matchesExpectedRejection(s, 'execute', message), false);
  }
  assert.equal(matchesExpectedRejection(s, 'execute', 'Failed constraint\nassert(h_p_computed == h_p);'), true);
  assert.equal(matchesExpectedRejection(s, 'prove', 'Failed constraint\nassert(h_p_computed == h_p);'), false);
});
test('S5 uses actual policy failure evidence rather than tamper name', () => {
  const s = attestationScenarios().find(s => s.id === 'S5')!;
  assert.equal(classifyFailure('execute', 'Failed constraint\nassert(h_p_computed == h_p);'), 'policy_hash');
  assert.equal(matchesExpectedRejection(s, 'execute', 'Failed constraint\nassert(ok);'), false);
});
