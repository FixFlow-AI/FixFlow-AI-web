/**
 * AI-008 unit checks for the AI-independent core: JSON Patch correctness and
 * the proposal-plan repository's optimistic-concurrency + idempotency
 * guarantees. Run via `node dist/test/testPlan.js` after build.
 *
 * (The deterministic plan validation itself is proven in the Python suite;
 * these tests cover the pieces unique to the Node gateway.)
 */
process.env.PERSISTENCE_PROVIDER = 'memory';

import assert from 'assert';
import {
  applyJsonPatch,
  changedScopes,
  scopesDisjoint,
  JsonPatchError,
  type JsonPatchOperation,
} from '../services/jsonPatch.js';
import {
  getProposalPlanRepository,
  __resetProposalPlanRepository,
  PlanRevisionConflictError,
  type ProposalPlanDocument,
  type ProposalPlanRevision,
} from '../services/proposalPlanRepository.js';
import type { ExecutionPlan, PlanDiagnostics } from '../types/ai.js';

let passed = 0;
function ok(label: string) {
  passed += 1;
  console.log(`  -> PASSED: ${label}`);
}

function emptyDiagnostics(): PlanDiagnostics {
  return {
    valid: true, issues: [], capacity: [], scopeCoverage: [],
    coveredRequirementCount: 0, totalRequirementCount: 0, unresolvedQuestionCount: 0,
    weekCount: 0, taskCount: 0, errorCount: 0, warningCount: 0,
  };
}

function stubPlan(): ExecutionPlan {
  return {
    schemaVersion: 2, degraded: false, planningAssumptions: [], openQuestions: [],
    requirements: [], scopeModules: [], workstreams: [], teamCapacity: [],
    deliverables: [],
    tasks: [{ id: 't1', title: 'Old', description: 'd', moduleId: 'm', workstreamId: 'w',
      ownerRoleId: 'r', estimateHours: 5, startWeek: 1, endWeek: 1, dependencyTaskIds: [],
      acceptanceCriteria: ['x'], evidenceRequired: [], status: 'planned', priority: 'should' }],
    weeks: [], checkpoints: [], risks: [],
  };
}

async function testJsonPatch() {
  console.log('[Plan Test 1] JSON Patch apply/immutability...');
  const plan = stubPlan();
  const ops: JsonPatchOperation[] = [{ op: 'replace', path: '/tasks/0/title', value: 'New title' }];
  const next = applyJsonPatch(plan, ops);
  assert.strictEqual(next.tasks[0].title, 'New title', 'replace should update the value');
  assert.strictEqual(plan.tasks[0].title, 'Old', 'original must be untouched (immutability)');
  ok('replace updates a nested array field without mutating the input');

  const added = applyJsonPatch(plan, [{ op: 'add', path: '/tasks/0/acceptanceCriteria/-', value: 'y' }]);
  assert.deepStrictEqual(added.tasks[0].acceptanceCriteria, ['x', 'y'], 'add "-" should append');
  ok('add with "-" appends to an array');

  const removed = applyJsonPatch(plan, [{ op: 'remove', path: '/tasks/0/evidenceRequired' }]);
  assert.ok(!('evidenceRequired' in removed.tasks[0]), 'remove should delete the key');
  ok('remove deletes an object key');

  assert.throws(
    () => applyJsonPatch(plan, [{ op: 'replace', path: '/tasks/9/title', value: 'z' }]),
    JsonPatchError,
    'out-of-range index must throw',
  );
  ok('out-of-range path throws JsonPatchError');

  assert.throws(
    () => applyJsonPatch(plan, [{ op: 'move' as any, path: '/x', value: 1 }]),
    JsonPatchError,
    'unsupported op must throw',
  );
  ok('unsupported op throws JsonPatchError');
}

async function testConflictScopes() {
  console.log('[Plan Test 2] conflict-scope disjointness...');
  const a = changedScopes([{ op: 'replace', path: '/tasks/0/title', value: 'a' }]);
  const b = changedScopes([{ op: 'replace', path: '/tasks/1/title', value: 'b' }]);
  const c = changedScopes([{ op: 'replace', path: '/tasks/0/estimateHours', value: 3 }]);
  assert.ok(scopesDisjoint(a, b), 'edits to different tasks are disjoint (auto-merge)');
  assert.ok(!scopesDisjoint(a, c), 'edits to the same task conflict');
  ok('disjoint edits merge; same-target edits conflict');
}

async function testRepositoryConcurrency() {
  console.log('[Plan Test 3] repository optimistic concurrency + idempotency...');
  __resetProposalPlanRepository();
  const repo = getProposalPlanRepository();
  const now = new Date().toISOString();
  const baseline = stubPlan();
  const doc: ProposalPlanDocument = {
    proposalId: 'p1', currentRevision: 0, status: 'draft',
    generatedBaseline: baseline, currentPlan: baseline, lastValidatedAt: now, updatedAt: now,
  };
  await repo.createDocument(doc);

  const rev1: ProposalPlanRevision = {
    proposalId: 'p1', revision: 1, operationId: 'op-1', actorUserId: 'u1', actorRole: 'client',
    occurredAt: now, summary: 'edit', operations: [{ op: 'replace', path: '/tasks/0/title', value: 'v1' }],
    previousHash: '0'.repeat(64), entryHash: 'h1', diagnosticsAfter: emptyDiagnostics(), planAfter: baseline,
  };
  await repo.commit({ ...doc, currentRevision: 1 }, rev1, 0);
  ok('commit with matching expectedRevision succeeds');

  // Stale write: expectedRevision 0 again must conflict now that current is 1.
  let conflicted = false;
  try {
    await repo.commit({ ...doc, currentRevision: 1 }, { ...rev1, revision: 1, operationId: 'op-x' }, 0);
  } catch (err) {
    conflicted = err instanceof PlanRevisionConflictError;
  }
  assert.ok(conflicted, 'stale expectedRevision must raise PlanRevisionConflictError');
  ok('stale write is rejected with a conflict');

  const found = await repo.findRevisionByOperationId('p1', 'op-1');
  assert.ok(found && found.revision === 1, 'operationId lookup enables idempotent replay');
  ok('revision is findable by operationId (idempotency key)');

  const revs = await repo.listRevisions('p1');
  assert.strictEqual(revs.length, 1, 'only the successful revision is stored');
  ok('failed commit left no partial revision');
}

(async () => {
  console.log('==========================================');
  console.log('AI-008 PLAN CORE VERIFICATION');
  console.log('==========================================');
  await testJsonPatch();
  await testConflictScopes();
  await testRepositoryConcurrency();
  console.log('==========================================');
  console.log(`ALL ${passed} PLAN CORE CHECKS PASSED`);
  console.log('==========================================');
})().catch((err) => {
  console.error('PLAN TEST FAILED:', err);
  process.exit(1);
});
