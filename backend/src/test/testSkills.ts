import {
  Milestone,
  transitionMilestone,
  verifyAuditChain,
  VersionMismatchError,
  InvalidTransitionError,
  AuditTrailBlock
} from '../skills/escrowStateMachine.js';
import { sanitizeAndPatchBrief } from '../skills/briefParser.js';
import { calculateEarningsBreakdown } from '../skills/earningsCalculator.js';
import { calculateClientScore } from '../skills/clientScoring.js';
import { calculateReputationMetrics, buildSBTMetadata } from '../skills/reputationCalculator.js';
import { generateInterviewQuestions } from '../skills/interviewGenerator.js';
import { generateContractExtensions } from '../skills/contextExtensions.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
} from '../services/paymentService.js';

async function runTests() {
  console.log('==========================================');
  console.log('FIXFLOW AI SUBSYSTEM VERIFICATION SUITE');
  console.log('==========================================\n');

  let passed = true;

  // ----------------------------------------------------
  // TEST 1: Zod Fallback Heuristics & Brief Sanitization
  // ----------------------------------------------------
  try {
    console.log('[Test 1] Verifying Zod brief sanitization & defaults...');
    const emptyPayload = {};
    const sanitized = sanitizeAndPatchBrief(emptyPayload);

    if (!sanitized.project_summary) throw new Error('Missing project_summary default');
    if (sanitized.features.length === 0) throw new Error('Features array should not be empty');
    if (sanitized.risks.length === 0) throw new Error('Risks array should not be empty');
    if (sanitized.timeline.length === 0) throw new Error('Timeline array should not be empty');
    if (sanitized.delivery_plan.weeks.length === 0) throw new Error('Weeks array should not be empty');
    
    console.log('  -> PASSED: Successfully coerced malformed inputs to structured Proposal Schema.');
  } catch (error: any) {
    console.error('  -> FAILED:', error.message);
    passed = false;
  }

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
  // TEST 8: AI-Generated Interview Questions and Extensions Fallbacks
  // ----------------------------------------------------
  try {
    console.log('[Test 8] Verifying AI-driven screening and extension fallback interfaces...');
    const mockApiKey = 'mock-key';
    
    // Test that interview generator fallback works without throwing if API fails
    const questionsResult = await generateInterviewQuestions('Build an API', {}, ['Rust'], mockApiKey);
    if (!questionsResult.questions || questionsResult.questions.length === 0) {
      throw new Error('Interview generator fallback returned empty questions list');
    }
    if (questionsResult.questions[0].question.indexOf('Rust') === -1) {
      throw new Error('Fallback questions did not customize based on missing skills');
    }

    // Test that context extensions fallback works without throwing if API fails
    const extensionsResult = await generateContractExtensions('Deliverable 1 completed', 'We need phase 2 next', mockApiKey);
    if (!extensionsResult.suggestedMilestones || extensionsResult.suggestedMilestones.length === 0) {
      throw new Error('Extensions fallback returned empty suggestions list');
    }
    console.log('  -> PASSED: Interview generator and contract extension fallback engines are robust.');
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
    if (!isWebhookValid) {
      throw new Error('Webhook signature verification failed');
    }

    console.log('  -> PASSED: Razorpay payment service verification successful.');
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
