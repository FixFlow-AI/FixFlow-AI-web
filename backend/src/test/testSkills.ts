import {
  Milestone,
  transitionMilestone,
  verifyAuditChain,
  VersionMismatchError,
  InvalidTransitionError,
  AuditTrailBlock
} from '../skills/escrowStateMachine.js';
import { sanitizeAndPatchBrief } from '../skills/briefParser.js';

function runTests() {
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

  console.log('\n==========================================');
  if (passed) {
    console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY!');
  } else {
    console.error('VERIFICATION SUITE ENCOUNTERED FAILURES.');
    process.exit(1);
  }
  console.log('==========================================');
}

runTests();
