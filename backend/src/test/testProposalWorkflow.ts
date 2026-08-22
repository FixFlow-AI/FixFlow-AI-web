/**
 * Checks for the proposal builder's sequential-approval sanitisation
 * (`sanitizeWorkflow`), which keeps the persisted step/approval state valid no
 * matter what a client sends. Run via `node dist/test/testProposalWorkflow.js`
 * after build.
 */
import assert from 'assert';
import { PROPOSAL_TOTAL_STEPS, sanitizeWorkflow } from '../services/proposalWorkflow.js';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  -> PASSED: ${label}`);
}

function testContiguousPrefix() {
  console.log('[Workflow Test 1] approvedSteps is coerced to a contiguous prefix...');

  const clean = sanitizeWorkflow(3, [1, 2]);
  assert.deepStrictEqual(clean.approvedSteps, [1, 2], 'a valid prefix survives untouched');
  assert.strictEqual(clean.activeStep, 3, 'activeStep may be one past the highest approved step');
  ok('an already-valid workflow passes through unchanged');

  const gapped = sanitizeWorkflow(5, [1, 3, 4]);
  assert.deepStrictEqual(gapped.approvedSteps, [1], 'everything after a gap is dropped');
  assert.strictEqual(gapped.activeStep, 2, 'activeStep is clamped to highest approved + 1');
  ok('a gap truncates the prefix and pulls activeStep back');

  const noisy = sanitizeWorkflow(2, [2, 1, 1, 2.5, -3, 0, PROPOSAL_TOTAL_STEPS + 1, 'x', null]);
  assert.deepStrictEqual(noisy.approvedSteps, [1, 2], 'duplicates, floats and out-of-range values are removed');
  ok('duplicates, floats, negatives, over-range and non-numbers are filtered out');

  assert.deepStrictEqual(sanitizeWorkflow(1, 'nope').approvedSteps, [], 'a non-array yields no approvals');
  assert.deepStrictEqual(sanitizeWorkflow(1, undefined).approvedSteps, [], 'undefined yields no approvals');
  ok('a non-array approvedSteps degrades to an empty prefix');
}

function testActiveStepBounds() {
  console.log('[Workflow Test 2] activeStep stays within [1, min(maxApproved + 1, TOTAL)]...');

  assert.strictEqual(sanitizeWorkflow(0, []).activeStep, 1, 'zero is raised to 1');
  assert.strictEqual(sanitizeWorkflow(-7, []).activeStep, 1, 'negatives are raised to 1');
  assert.strictEqual(sanitizeWorkflow(2.5, []).activeStep, 1, 'a non-integer falls back to 1');
  assert.strictEqual(sanitizeWorkflow(undefined, []).activeStep, 1, 'a missing step falls back to 1');
  ok('invalid activeStep values fall back to the first step');

  assert.strictEqual(sanitizeWorkflow(99, []).activeStep, 1, 'no approvals means only step 1 is reachable');
  assert.strictEqual(sanitizeWorkflow(99, [1, 2, 3]).activeStep, 4, 'skipping ahead is capped at maxApproved + 1');
  const all = [...Array(PROPOSAL_TOTAL_STEPS)].map((_, i) => i + 1);
  assert.strictEqual(
    sanitizeWorkflow(99, all).activeStep,
    PROPOSAL_TOTAL_STEPS,
    'a fully approved workflow caps at the last step',
  );
  ok('activeStep can never run ahead of the approvals or past the last step');
}

function testTimestamp() {
  console.log('[Workflow Test 3] every sanitisation stamps a fresh ISO timestamp...');
  const { updatedAt } = sanitizeWorkflow(1, [1]);
  assert.ok(!Number.isNaN(Date.parse(updatedAt)), 'updatedAt must be a parseable ISO timestamp');
  ok('updatedAt is a parseable ISO timestamp (feeds the last-write-wins guard)');
}

(() => {
  console.log('==========================================');
  console.log('PROPOSAL WORKFLOW SANITISATION VERIFICATION');
  console.log('==========================================');
  testContiguousPrefix();
  testActiveStepBounds();
  testTimestamp();
  console.log('==========================================');
  console.log(`ALL ${passed} PROPOSAL WORKFLOW CHECKS PASSED`);
  console.log('==========================================');
})();
