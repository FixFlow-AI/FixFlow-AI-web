import crypto from 'crypto';
import {
  Milestone,
  transitionMilestone,
  verifyAuditChain,
  VersionMismatchError,
  InvalidTransitionError,
  AuditTrailBlock
} from '../skills/escrowStateMachine.js';
import { calculateEarningsBreakdown } from '../skills/earningsCalculator.js';
import { calculateClientScore } from '../skills/clientScoring.js';
import { calculateReputationMetrics, buildSBTMetadata } from '../skills/reputationCalculator.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  transferFundsToFreelancer,
  refundPayment,
  createLinkedAccount,
} from '../services/paymentService.js';
import { getMilestoneRepository } from '../services/milestoneRepository.js';
import { applyTransition } from '../services/escrowService.js';
import {
  ClientMatchPermissionError,
  ClientMatchVersionMismatchError,
  InvalidClientMatchTransitionError,
  createClientMatchWorkflow,
  transitionClientMatch,
  verifyClientMatchAudit,
} from '../services/clientMatchWorkflow.js';
import { buildClientMatchWorkflowCondition } from '../services/proposalRepository.js';

async function runTests() {
  console.log('==========================================');
  console.log('FIXFLOW AI SUBSYSTEM VERIFICATION SUITE');
  console.log('==========================================\n');

  let passed = true;

  // NOTE: Brief parsing (AI-001), interview generation (AI-003), and contract
  // extensions (AI-004) now live in the Python AI service (`ai-service/`).
  // Their tests moved there; this suite covers the TypeScript subsystems that
  // remain the system of record (escrow FSM, earnings, reputation, payments).

  // ----------------------------------------------------
  // TEST 2: Escrow FSM Valid Transitions & OCC Checks
  // ----------------------------------------------------
  try {
    console.log('[Test 2] Verifying Escrow State Transitions and OCC locks...');
    
    let milestone: Milestone = {
      id: 'ms-101',
      proposalId: 'prop-202',
      title: 'Setup Database Schemas',
      amount: 1500,
      state: 'Draft',
      version: 1,
      lastAuditHash: ''
    };

    const blocks: AuditTrailBlock[] = [];

    // Valid Transition 1: Draft -> Pending_Deposit
    const res1 = transitionMilestone(milestone, 'Pending_Deposit', 'u-client', 'Client', 1, blocks.length);
    milestone = res1.updatedMilestone;
    blocks.push(res1.newBlock);

    if (milestone.state !== 'Pending_Deposit') throw new Error('Transition to Pending_Deposit failed');
    if (milestone.version !== 2) throw new Error('Version increment failed');

    // Valid Transition 2: Pending_Deposit -> Active
    const res2 = transitionMilestone(milestone, 'Active', 'u-system', 'System', 2, blocks.length);
    milestone = res2.updatedMilestone;
    blocks.push(res2.newBlock);

    if (milestone.state !== 'Active') throw new Error('Transition to Active failed');
    if (milestone.version !== 3) throw new Error('Version increment failed');

    // OCC Check: Attempting to transition expecting version 2 (actual version is 3)
    try {
      transitionMilestone(milestone, 'In_Review', 'u-freelancer', 'Freelancer', 2, blocks.length);
      throw new Error('Allowed transition with stale version (OCC failed)');
    } catch (err) {
      if (!(err instanceof VersionMismatchError)) {
        throw err;
      }
      console.log('  -> PASSED: Stale version write blocked correctly (OCC verified).');
    }

    // FSM Rule Check: Attempting to transition Draft -> Active directly
    try {
      let freshMilestone: Milestone = {
        id: 'ms-102',
        proposalId: 'prop-202',
        title: 'Draft setup',
        amount: 500,
        state: 'Draft',
        version: 1,
        lastAuditHash: ''
      };
      transitionMilestone(freshMilestone, 'Active', 'u-client', 'Client', 1, 0);
      throw new Error('FSM state transition check failed (Draft -> Active should be forbidden)');
    } catch (err) {
      if (!(err instanceof InvalidTransitionError)) {
        throw err;
      }
      console.log('  -> PASSED: Invalid state transition blocked correctly (FSM verified).');
    }

    console.log('  -> PASSED: Escrow state engine verified.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 3: Cryptographic Audit Trail Chain Integrity
  // ----------------------------------------------------
  try {
    console.log('[Test 3] Verifying Cryptographic Audit Chain Integrity...');

    let milestone: Milestone = {
      id: 'ms-999',
      proposalId: 'prop-999',
      title: 'E2E Ledger Audit',
      amount: 5000,
      state: 'Draft',
      version: 1,
      lastAuditHash: ''
    };

    const blocks: AuditTrailBlock[] = [];

    // Cycle of transitions
    const step1 = transitionMilestone(milestone, 'Pending_Deposit', 'user-1', 'Client', 1, blocks.length);
    milestone = step1.updatedMilestone;
    blocks.push(step1.newBlock);

    const step2 = transitionMilestone(milestone, 'Active', 'user-2', 'System', 2, blocks.length);
    milestone = step2.updatedMilestone;
    blocks.push(step2.newBlock);

    const step3 = transitionMilestone(milestone, 'In_Review', 'user-3', 'Freelancer', 3, blocks.length);
    milestone = step3.updatedMilestone;
    blocks.push(step3.newBlock);

    // Verify chain is valid
    const initialVerify = verifyAuditChain(blocks);
    if (!initialVerify) {
      throw new Error('Valid blockchain-chained ledger failed verification checks');
    }
    console.log('  -> PASSED: Chain ledger successfully validated with zero modifications.');

    // Malicious injection check: altering a block metadata
    const corruptedBlocks = JSON.parse(JSON.stringify(blocks)) as AuditTrailBlock[];
    corruptedBlocks[1].metadata = 'Corrupted payout record injection'; // Modify contents

    const corruptVerify = verifyAuditChain(corruptedBlocks);
    if (corruptVerify) {
      throw new Error('Corrupted block metadata was not detected by verifyAuditChain');
    }
    console.log('  -> PASSED: Tampering with ledger metadata correctly detected and flagged.');

    // Link breakage check: altering previousHash linkages
    const brokenLinkBlocks = JSON.parse(JSON.stringify(blocks)) as AuditTrailBlock[];
    brokenLinkBlocks[2].previousHash = 'a'.repeat(64); // Break the link

    const brokenLinkVerify = verifyAuditChain(brokenLinkBlocks);
    if (brokenLinkVerify) {
      throw new Error('Broken hash linkage was not detected by verifyAuditChain');
    }
    console.log('  -> PASSED: Broken chain links correctly detected and flagged.');

  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 4: Transparent Earnings Engine
  // ----------------------------------------------------
  try {
    console.log('[Test 4] Verifying transparent earnings calculator...');
    const breakdown = calculateEarningsBreakdown(10000, 'PRO', 'IN');
    if (breakdown.grossAmount !== 10000) throw new Error('Gross amount mismatch');
    if (breakdown.platformFee !== 300) throw new Error('Platform fee incorrect for PRO (3%)');
    if (breakdown.paymentGatewayFee !== 203) throw new Error('Razorpay fee incorrect (2% + ₹3)');
    if (breakdown.withholdingTax !== 100) throw new Error('TDS withholding incorrect for India (1%)');
    if (breakdown.netFreelancerEarnings !== (10000 - 300 - 203 - 100)) throw new Error('Net earnings incorrect');
    if (breakdown.totalClientCheckout !== 10150) throw new Error('Client checkout premium incorrect (1.5%)');
    console.log('  -> PASSED: Earnings breakdown values are accurate.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 5: Client Quality Scoring
  // ----------------------------------------------------
  try {
    console.log('[Test 5] Verifying client quality scoring and risk profiling...');
    const clientHistory = [
      { milestoneId: 'ms-1', edits: 2, hoursToApprove: 48, hasDispute: false, state: 'Approved' },
      { milestoneId: 'ms-2', edits: 0, hoursToApprove: 12, hasDispute: false, state: 'Approved' },
      { milestoneId: 'ms-3', edits: 1, hoursToApprove: 24, hasDispute: false, state: 'Approved' }
    ];
    const scoreResult = calculateClientScore(clientHistory);
    if (scoreResult.totalMilestones !== 3) throw new Error('Total milestones calculation mismatch');
    if (scoreResult.scopeStabilityScore !== 0) { // totalEdits=3, totalMilestones=3, 100 - (3/3*100) = 0
      throw new Error(`Scope stability score incorrect: ${scoreResult.scopeStabilityScore}`);
    }
    if (!scoreResult.riskLabels.includes('SCOPE_CREEP_RISK')) throw new Error('Scope creep risk not flagged');
    console.log('  -> PASSED: Client scoring and risk profiling verified.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 6: Reputation and SBT Builder
  // ----------------------------------------------------
  try {
    console.log('[Test 6] Verifying reputation metrics and SBT metadata builder...');
    const escrowHistory = [
      { milestoneId: 'ms-1', clientId: 'c-1', dueDate: '2026-06-01', completedDate: '2026-05-30', revisionCount: 0, hasDispute: false, state: 'Approved' },
      { milestoneId: 'ms-2', clientId: 'c-1', dueDate: '2026-06-15', completedDate: '2026-06-16', revisionCount: 1, hasDispute: false, state: 'Approved' }
    ];
    const repMetrics = calculateReputationMetrics(escrowHistory);
    if (repMetrics.totalMilestones !== 2) throw new Error('Total milestones mismatch');
    if (repMetrics.onTimeDeliveryRate !== 50) throw new Error('On-time rate mismatch');
    if (repMetrics.revisionEfficiencyScore !== 87.5) throw new Error('Revision efficiency score mismatch'); // avg = 0.5, 100 - 12.5 = 87.5
    
    const metadata = buildSBTMetadata(repMetrics, 'did:key:z6Mku7zP') as any;
    if (metadata.name !== 'FixFlow AI Reputation Badge - did:key:z6Mk...') throw new Error('SBT name metadata formatting incorrect');
    if (metadata.attributes[0].trait_type !== 'Composite Reputation Score') throw new Error('Metadata attributes incorrect');
    console.log('  -> PASSED: Reputation metrics and soulbound metadata verified.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 7: MFA Verification in Escrow State Machine
  // ----------------------------------------------------
  try {
    console.log('[Test 7] Verifying MFA rules inside Escrow FSM...');
    let fsmMilestone: Milestone = {
      id: 'ms-777',
      proposalId: 'prop-777',
      title: 'MFA release testing',
      amount: 4000,
      state: 'In_Review',
      version: 1,
      lastAuditHash: ''
    };

    // Transitioning to Approved state without MFA verifier callback should throw MFARequiredError
    try {
      transitionMilestone(fsmMilestone, 'Approved', 'u-client', 'Client', 1, 0);
      throw new Error('Allowed Approved transition without MFA');
    } catch (err: any) {
      if (err.name !== 'MFARequiredError') {
        throw new Error(`Expected MFARequiredError but got: ${err.name}`);
      }
      console.log('  -> PASSED: Blocking Approved state transition without MFA verifier hook.');
    }

    // Transitioning to Approved with failing verifier should throw validation failure
    try {
      transitionMilestone(fsmMilestone, 'Approved', 'u-client', 'Client', 1, 0, undefined, () => false);
      throw new Error('Allowed Approved transition with failing MFA verifier');
    } catch (err: any) {
      if (err.message.indexOf('MFA Verification Failed') === -1) {
        throw new Error(`Expected MFA Verification Failed error but got: ${err.message}`);
      }
      console.log('  -> PASSED: Blocking transition with failing MFA verifier.');
    }

    // Transitioning with successful verifier should succeed and have audit stamp
    const { updatedMilestone, newBlock } = transitionMilestone(
      fsmMilestone,
      'Approved',
      'u-client',
      'Client',
      1,
      0,
      undefined,
      () => true
    );
    if (updatedMilestone.state !== 'Approved') throw new Error('State transition failed with successful MFA');
    if (newBlock.metadata.indexOf('[MFA Verified]') === -1) {
      throw new Error(`MFA stamp missing from metadata: ${newBlock.metadata}`);
    }
    console.log('  -> PASSED: Validated transition and blockchain audit block stamp on successful MFA.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 9: Razorpay Payment Service (Simulated Mode)
  // ----------------------------------------------------
  try {
    console.log('[Test 9] Verifying Razorpay payment service and verification...');
    
    const order = await createRazorpayOrder('milestone-101', 5000);
    if (!order.id || order.amount !== 500000 || order.currency !== 'INR') {
      throw new Error(`Order creation failed or incorrect output: ${JSON.stringify(order)}`);
    }
    if (!order.isSimulated) {
      console.log('     Note: running with real Razorpay credentials');
    } else {
      console.log('     Note: running in simulated mode');
    }

    const isPaymentValid = verifyPaymentSignature(order.id, 'pay_12345', 'sig_12345');
    if (!isPaymentValid) {
      throw new Error('Payment signature verification failed for simulated order');
    }

    const isWebhookValid = verifyWebhookSignature('{}', 'signature', '');
    if (isWebhookValid) {
      throw new Error('Webhook signature verification succeeded with empty secret');
    }

    const testSecret = 'test_secret';
    const testBody = '{"event":"payment.captured"}';
    const expectedSignature = crypto
      .createHmac('sha256', testSecret)
      .update(testBody)
      .digest('hex');
    const isWebhookValidReal = verifyWebhookSignature(testBody, expectedSignature, testSecret);
    if (!isWebhookValidReal) {
      throw new Error('Webhook signature verification failed for valid signature');
    }

    console.log('  -> PASSED: Razorpay payment service verification successful.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 10: saveWithAuditBlock & applyTransition (MFA)
  // ----------------------------------------------------
  try {
    console.log('[Test 10] Verifying saveWithAuditBlock atomic writes and applyTransition MFA...');

    const repo = getMilestoneRepository();
    const testMilestone: Milestone = {
      id: 'ms-mfa-test',
      proposalId: 'prop-mfa-test',
      title: 'MFA integration test',
      amount: 1000,
      state: 'In_Review',
      version: 1,
      lastAuditHash: ''
    };

    await repo.create(testMilestone);

    const userRepo = (await import('../services/userRepository.js')).getUserRepository();
    const mfaUser = await userRepo.upsertFromGoogleProfile({
      googleSub: 'test-mfa-user-sub-12345',
      email: 'mfa-test-user@example.com',
      emailVerified: true,
      name: 'MFA Test User'
    });
    mfaUser.otpSecret = 'JBSWY3DPEHPK3PXP';

    // 1. Verify that applyTransition fails if MFA token is missing or incorrect
    try {
      await applyTransition(testMilestone.id, {
        toState: 'Approved',
        triggerUserId: mfaUser.id,
        triggerUserRole: 'Client',
        expectedVersion: 1,
        mfaToken: '111111' // Incorrect token
      });
      throw new Error('Allowed applyTransition with incorrect MFA token');
    } catch (err: any) {
      if (!err.message.includes('MFA Verification Failed') && !err.message.includes('MFA Verification Required')) {
        throw err;
      }
      console.log('  -> PASSED: Incorrect MFA token rejected successfully.');
    }

    // 2. Verify that applyTransition succeeds if correct TOTP is provided
    const { generateHotp } = await import('../auth/otpVerifier.js');
    const counter = Math.floor(Date.now() / 30000);
    const validToken = generateHotp('JBSWY3DPEHPK3PXP', counter);

    const transitionRes = await applyTransition(testMilestone.id, {
      toState: 'Approved',
      triggerUserId: mfaUser.id,
      triggerUserRole: 'Client',
      expectedVersion: 1,
      mfaToken: validToken
    });

    if (transitionRes.milestone.state !== 'Approved') {
      throw new Error('State transition failed even with correct MFA token');
    }
    console.log('  -> PASSED: Correct MFA token accepted successfully.');

    // 3. Verify saveWithAuditBlock atomicity/rollback in InMemory repo
    const mockBlock: AuditTrailBlock = {
      index: 10,
      timestamp: new Date().toISOString(),
      milestoneId: 'ms-mfa-test',
      fromState: 'Draft',
      toState: 'Active',
      triggerUserId: 'u-1',
      triggerUserRole: 'Client',
      metadata: 'metadata',
      previousHash: '',
      hash: 'hash'
    };

    const repoAny = repo as any;
    let originalFn: any;
    let targetObj: any;
    let key: string;

    if (typeof repoAny.persist === 'function') {
      targetObj = repoAny;
      key = 'persist';
      originalFn = repoAny.persist;
      repoAny.persist = () => { throw new Error('Simulated repository write failure'); };
    } else {
      targetObj = repoAny.milestones;
      key = 'set';
      originalFn = repoAny.milestones.set;
      repoAny.milestones.set = () => { throw new Error('Simulated repository write failure'); };
    }

    const milestoneBefore = await repo.get(testMilestone.id);
    const beforeVersion = milestoneBefore?.version || 1;

    try {
      const updatedM: Milestone = { ...milestoneBefore!, version: beforeVersion + 1, state: 'Active' };
      await repo.saveWithAuditBlock(updatedM, mockBlock);
      throw new Error('saveWithAuditBlock succeeded despite write failure');
    } catch (err: any) {
      if (err.message !== 'Simulated repository write failure') {
        throw err;
      }
      const rolledBack = await repo.get(testMilestone.id);
      if (rolledBack?.state !== milestoneBefore?.state || rolledBack?.version !== beforeVersion) {
        throw new Error('Rollback failed to restore previous milestone state');
      }
      console.log('  -> PASSED: saveWithAuditBlock rolled back successfully on write failure.');
    } finally {
      targetObj[key] = originalFn;
    }

  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 11: Client hiring-match FSM, OCC, and audit chain
  // ----------------------------------------------------
  try {
    console.log('[Test 11] Verifying client hiring-match FSM, OCC, and audit trail...');
    const shortlist = {
      shortlist: [
        {
          freelancerId: 'freelancer-1',
          name: 'Ada Lovelace',
          title: 'Full-stack Engineer',
          compositeScore: 91,
          factorBreakdown: { skillOverlap: 95, githubSignal: 88 },
          fitReasons: ['Strong verified React and Node.js evidence'],
          skillGaps: [],
          riskFlags: [],
          matchType: 'primary' as const,
        },
      ],
      supplementary: [],
      coverage: {
        requiredSkills: ['React', 'Node.js'],
        coveredSkills: ['React', 'Node.js'],
        uncoveredSkills: [],
        coveragePct: 100,
        strongCandidateCount: 1,
        teamRecommended: false,
      },
      totalCandidatesEvaluated: 1,
    };

    let workflow = createClientMatchWorkflow(shortlist, 'client-1');
    if (!verifyClientMatchAudit(workflow) || workflow.auditTrail[0].triggerUserId !== 'client-1') {
      throw new Error('Initial shortlist did not produce a valid, attributed audit entry');
    }

    workflow = transitionClientMatch(workflow, 'freelancer-1', 'shortlist', workflow.version, 'client-1', 'client');
    workflow = transitionClientMatch(workflow, 'freelancer-1', 'invite', workflow.version, 'client-1', 'client');

    // A client must NOT be able to hire someone who never agreed. Both of these
    // are the consent bypass the two-sided handshake exists to prevent.
    for (const forbidden of ['start_interview', 'select'] as const) {
      try {
        transitionClientMatch(workflow, 'freelancer-1', forbidden, workflow.version, 'client-1', 'client');
        throw new Error(`Client skipped freelancer consent via "${forbidden}"`);
      } catch (error) {
        if (!(error instanceof InvalidClientMatchTransitionError)) throw error;
      }
    }

    // A client must not be able to accept on the freelancer's behalf either.
    try {
      transitionClientMatch(workflow, 'freelancer-1', 'accept', workflow.version, 'client-1', 'client');
      throw new Error('Client was allowed to accept its own invitation');
    } catch (error) {
      if (!(error instanceof ClientMatchPermissionError)) throw error;
    }

    // ...and a freelancer must not be able to select themselves.
    try {
      transitionClientMatch(workflow, 'freelancer-1', 'select', workflow.version, 'freelancer-1', 'freelancer');
      throw new Error('Freelancer was allowed to select themselves');
    } catch (error) {
      if (!(error instanceof ClientMatchPermissionError)) throw error;
    }

    // The freelancer consents, and only then can the client proceed.
    workflow = transitionClientMatch(workflow, 'freelancer-1', 'accept', workflow.version, 'freelancer-1', 'freelancer');
    if (workflow.candidates[0].status !== 'accepted') {
      throw new Error('Freelancer acceptance did not move the candidate to accepted');
    }
    const acceptEntry = workflow.auditTrail[workflow.auditTrail.length - 1];
    if (acceptEntry.triggerRole !== 'freelancer' || acceptEntry.action !== 'accept') {
      throw new Error('Acceptance was not attributed to the freelancer in the audit trail');
    }

    workflow = transitionClientMatch(workflow, 'freelancer-1', 'select', workflow.version, 'client-1', 'client');
    if (workflow.candidates[0].status !== 'selected' || !verifyClientMatchAudit(workflow)) {
      throw new Error('Valid client hiring transitions did not preserve an auditable selected state');
    }

    try {
      transitionClientMatch(workflow, 'freelancer-1', 'archive', workflow.version - 1, 'client-1', 'client');
      throw new Error('Stale client-match version was accepted');
    } catch (error) {
      if (!(error instanceof ClientMatchVersionMismatchError)) throw error;
    }

    try {
      transitionClientMatch(workflow, 'freelancer-1', 'invite', workflow.version, 'client-1', 'client');
      throw new Error('Terminal selected state accepted an invalid transition');
    } catch (error) {
      if (!(error instanceof InvalidClientMatchTransitionError)) throw error;
    }

    // A declined invitation is terminal apart from the client archiving it.
    let declinedFlow = createClientMatchWorkflow(shortlist, 'client-1');
    declinedFlow = transitionClientMatch(declinedFlow, 'freelancer-1', 'invite', declinedFlow.version, 'client-1', 'client');
    declinedFlow = transitionClientMatch(declinedFlow, 'freelancer-1', 'decline', declinedFlow.version, 'freelancer-1', 'freelancer');
    if (declinedFlow.candidates[0].status !== 'declined') {
      throw new Error('Decline did not move the candidate to declined');
    }
    try {
      transitionClientMatch(declinedFlow, 'freelancer-1', 'select', declinedFlow.version, 'client-1', 'client');
      throw new Error('A declined candidate could still be selected');
    } catch (error) {
      if (!(error instanceof InvalidClientMatchTransitionError)) throw error;
    }

    const tampered = {
      ...workflow,
      auditTrail: workflow.auditTrail.map((entry, index) =>
        index === 1 ? { ...entry, triggerUserId: 'attacker' } : entry,
      ),
    };
    if (verifyClientMatchAudit(tampered)) {
      throw new Error('Tampered client-match audit chain was accepted');
    }

    const initialWrite = buildClientMatchWorkflowCondition();
    if (
      initialWrite.ConditionExpression !== 'attribute_not_exists(#workflow)' ||
      !initialWrite.ExpressionAttributeNames ||
      '#version' in initialWrite.ExpressionAttributeNames ||
      'ExpressionAttributeValues' in initialWrite
    ) {
      throw new Error('Initial client-match DynamoDB condition includes unused expression aliases');
    }

    const versionedWrite = buildClientMatchWorkflowCondition(workflow.version);
    if (
      versionedWrite.ConditionExpression !== '#workflow.#version = :expectedVersion' ||
      versionedWrite.ExpressionAttributeNames?.['#version'] !== 'version' ||
      versionedWrite.ExpressionAttributeValues?.[':expectedVersion'] !== workflow.version
    ) {
      throw new Error('Versioned client-match DynamoDB condition is malformed');
    }
    console.log('  -> PASSED: Client hiring-match state transitions, OCC, and audit chain verified.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 12: Payout, Refund & Linked Account (Simulated Mode)
  // ----------------------------------------------------
  try {
    console.log('[Test 12] Verifying payout, refund, and Razorpay Route linked-account services...');

    const payout = await transferFundsToFreelancer(8697, 'acc_mock_freelancer');
    if (!payout.success || !payout.transferId) {
      throw new Error(`Payout transfer failed in simulated mode: ${JSON.stringify(payout)}`);
    }

    const fullRefund = await refundPayment('pay_mock_abc123');
    if (!fullRefund.success || !fullRefund.refundId) {
      throw new Error(`Full refund failed in simulated mode: ${JSON.stringify(fullRefund)}`);
    }

    const partialRefund = await refundPayment('pay_mock_abc123', 2500);
    if (!partialRefund.success || !partialRefund.refundId) {
      throw new Error(`Partial refund failed in simulated mode: ${JSON.stringify(partialRefund)}`);
    }

    const linked = await createLinkedAccount({
      email: 'freelancer@example.com',
      name: 'Test Freelancer',
      legalBusinessName: 'Test Freelancer Studio',
    });
    if (!linked.success || !linked.accountId || !linked.accountId.startsWith('acc_')) {
      throw new Error(`Linked account creation failed in simulated mode: ${JSON.stringify(linked)}`);
    }
    console.log('  -> PASSED: Payout, refund, and linked-account services verified.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 13: Webhook Idempotency Store
  // ----------------------------------------------------
  try {
    console.log('[Test 13] Verifying webhook idempotency store...');
    // Force the in-memory provider so the test is hermetic and side-effect free.
    const prevProvider = process.env.PERSISTENCE_PROVIDER;
    process.env.PERSISTENCE_PROVIDER = 'memory';
    // Import fresh so the factory picks up the memory provider.
    const { getWebhookEventRepository } = await import('../services/webhookEventRepository.js');
    const repo = getWebhookEventRepository();

    const eventId = 'evt_test_' + crypto.randomBytes(4).toString('hex');
    if (await repo.hasProcessed(eventId)) {
      throw new Error('Fresh event id was unexpectedly reported as processed');
    }
    await repo.markProcessed(eventId);
    if (!(await repo.hasProcessed(eventId))) {
      throw new Error('Event id was not recorded as processed after markProcessed');
    }
    // Restore prior provider setting.
    if (prevProvider === undefined) delete process.env.PERSISTENCE_PROVIDER;
    else process.env.PERSISTENCE_PROVIDER = prevProvider;
    console.log('  -> PASSED: Webhook idempotency store correctly tracks processed events.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 14: Earnings Calculator — All Tiers (STORY-24)
  // ----------------------------------------------------
  try {
    console.log('[Test 14] Verifying earnings across all platform tiers + TDS + premium...');
    const cases = [
      { plan: 'FREE', rate: 0.10 },
      { plan: 'SOLO', rate: 0.05 },
      { plan: 'PRO', rate: 0.03 },
      { plan: 'AGENCY', rate: 0.02 },
    ];
    for (const c of cases) {
      const gross = 20000;
      const b = calculateEarningsBreakdown(gross, c.plan, 'IN');
      const expectedPlatform = Math.round(gross * c.rate * 100) / 100;
      if (b.platformFee !== expectedPlatform) {
        throw new Error(`${c.plan} platform fee wrong: got ${b.platformFee}, expected ${expectedPlatform}`);
      }
      const expectedGateway = Math.round((gross * 0.02 + 3) * 100) / 100;
      if (b.paymentGatewayFee !== expectedGateway) throw new Error(`${c.plan} gateway fee wrong`);
      if (b.withholdingTax !== Math.round(gross * 0.01 * 100) / 100) throw new Error(`${c.plan} TDS wrong`);
      if (b.totalClientCheckout !== gross + Math.round(gross * 0.015 * 100) / 100) throw new Error(`${c.plan} client premium wrong`);
    }
    // Non-India → no TDS.
    const intl = calculateEarningsBreakdown(20000, 'FREE', 'US');
    if (intl.withholdingTax !== 0) throw new Error('Non-India TDS should be zero');
    console.log('  -> PASSED: All tier commissions, TDS, and client premium verified.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  // ----------------------------------------------------
  // TEST 15: End-to-End Escrow Pipeline (STORY-25)
  // Create → Fund(order) → Verify → Submit → Approve(MFA) → Release(MFA)
  // ----------------------------------------------------
  try {
    console.log('[Test 15] Verifying end-to-end escrow pipeline...');
    const { createMilestone, getAuditChain } = await import('../services/escrowService.js');
    const { generateHotp } = await import('../auth/otpVerifier.js');
    // Seeded user with a known TOTP secret (also used by Test 10).
    const clientUserId = '1c813e5f-e04a-48cf-bebe-a89d4c528037';
    const otpSecret = 'JBSWY3DPEHPK3PXP';
    const mfa = () => generateHotp(otpSecret, Math.floor(Date.now() / 30000));

    const ms = await createMilestone({ proposalId: 'prop-e2e', title: 'E2E milestone', amount: 10000 });
    if (ms.state !== 'Draft' || ms.version !== 0) throw new Error('Milestone did not initialize in Draft/v0');

    // Draft → Pending_Deposit (order created)
    let r = await applyTransition(ms.id, { toState: 'Pending_Deposit', triggerUserId: clientUserId, triggerUserRole: 'Client', expectedVersion: 0, metadata: 'order created' });
    // Pending_Deposit → Active (payment verified)
    r = await applyTransition(ms.id, { toState: 'Active', triggerUserId: 'system', triggerUserRole: 'System', expectedVersion: r.milestone.version, metadata: 'payment verified' });
    // Active → In_Review (freelancer submits)
    r = await applyTransition(ms.id, { toState: 'In_Review', triggerUserId: 'freelancer-e2e', triggerUserRole: 'Freelancer', expectedVersion: r.milestone.version, metadata: 'evidence submitted' });
    // In_Review → Approved (client approves, MFA)
    r = await applyTransition(ms.id, { toState: 'Approved', triggerUserId: clientUserId, triggerUserRole: 'Client', expectedVersion: r.milestone.version, mfaToken: mfa() });
    // Approved → Funds_Released (client releases, MFA)
    r = await applyTransition(ms.id, { toState: 'Funds_Released', triggerUserId: clientUserId, triggerUserRole: 'Client', expectedVersion: r.milestone.version, mfaToken: mfa() });

    if (r.milestone.state !== 'Funds_Released') throw new Error(`Pipeline ended in ${r.milestone.state}, expected Funds_Released`);

    const audit = await getAuditChain(ms.id);
    if (!audit.valid) throw new Error('E2E audit chain failed verification');
    if (audit.blocks.length !== 5) throw new Error(`Expected 5 audit blocks, found ${audit.blocks.length}`);

    // Payout amount is computed from the earnings engine (not client input).
    const payout = calculateEarningsBreakdown(ms.amount, 'FREE', 'IN');
    if (payout.netFreelancerEarnings !== 10000 - 1000 - 203 - 100) throw new Error('Net payout mismatch in pipeline');

    console.log('  -> PASSED: Full create→fund→verify→approve→release pipeline verified with intact audit chain.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

  console.log('\n==========================================');
  if (passed) {
    console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  } else {
    console.error('VERIFICATION SUITE ENCOUNTERED FAILURES.');
    process.exit(1);
  }
  console.log('==========================================');
}

runTests().catch(err => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});
