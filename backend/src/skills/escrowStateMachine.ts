import * as crypto from 'crypto';

// ==========================================
// FSM Types & Interfaces
// ==========================================

export type MilestoneState =
  | 'Draft'
  | 'Pending_Deposit'
  | 'Active'
  | 'In_Review'
  | 'Revision_Requested'
  | 'Approved'
  | 'Funds_Released'
  | 'Dispute';

export type UserRole = 'Freelancer' | 'Client' | 'Arbitrator' | 'System';

export interface Milestone {
  id: string;
  proposalId: string;
  title: string;
  amount: number;
  state: MilestoneState;
  version: number; // Optimistic Concurrency Control Version Counter
  lastAuditHash: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

export interface AuditTrailBlock {
  index: number;
  timestamp: string;
  milestoneId: string;
  fromState: MilestoneState | 'None';
  toState: MilestoneState;
  triggerUserId: string;
  triggerUserRole: UserRole;
  metadata: string;
  previousHash: string;
  hash: string;
}

// ==========================================
// Custom Error Definitions
// ==========================================

export class VersionMismatchError extends Error {
  constructor(milestoneId: string, expected: number, actual: number) {
    super(
      `Optimistic Concurrency Control Failure: Milestone [${milestoneId}] version conflict. Expected version ${expected}, but found version ${actual}. Transaction aborted to prevent double-spending.`
    );
    this.name = 'VersionMismatchError';
  }
}

export class InvalidTransitionError extends Error {
  constructor(milestoneId: string, from: MilestoneState, to: MilestoneState) {
    super(`FSM State Transition Rule Violation: Cannot transition Milestone [${milestoneId}] from state [${from}] to [${to}].`);
    this.name = 'InvalidTransitionError';
  }
}

export class MFARequiredError extends Error {
  constructor(milestoneId: string, targetState: MilestoneState) {
    super(`MFA Verification Required: Milestone [${milestoneId}] transition to state [${targetState}] requires Multi-Factor Authentication.`);
    this.name = 'MFARequiredError';
  }
}

export type MFAVerifier = (milestoneId: string, state: MilestoneState) => boolean;

// ==========================================
// FSM State Transition Rule Matrix
// ==========================================

const ALLOWED_TRANSITIONS: Record<MilestoneState, MilestoneState[]> = {
  Draft: ['Pending_Deposit'],
  Pending_Deposit: ['Active', 'Draft'],
  Active: ['In_Review', 'Dispute'],
  In_Review: ['Approved', 'Revision_Requested', 'Dispute'],
  Revision_Requested: ['In_Review', 'Dispute'],
  Approved: ['Funds_Released'],
  Funds_Released: [], // Terminal State
  Dispute: ['Approved', 'Funds_Released', 'Draft', 'Pending_Deposit']
};

// ==========================================
// Cryptographic Hash & Chain Builder
// ==========================================

/**
 * Calculates a SHA-256 block hash for the audit ledger.
 */
export function calculateBlockHash(block: Omit<AuditTrailBlock, 'hash'>): string {
  const content = [
    block.index.toString(),
    block.timestamp,
    block.milestoneId,
    block.fromState,
    block.toState,
    block.triggerUserId,
    block.triggerUserRole,
    block.metadata,
    block.previousHash
  ].join('|');

  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Validates a transition and builds an immutable audit block.
 */
export function transitionMilestone(
  milestone: Milestone,
  toState: MilestoneState,
  triggerUserId: string,
  triggerUserRole: UserRole,
  expectedVersion: number,
  previousBlockIndex: number = 0,
  metadata?: string,
  mfaVerifier?: MFAVerifier
): { updatedMilestone: Milestone; newBlock: AuditTrailBlock } {
  
  // 1. Optimistic Concurrency Control Check
  if (milestone.version !== expectedVersion) {
    throw new VersionMismatchError(milestone.id, expectedVersion, milestone.version);
  }

  // 2. Validate FSM State Rules
  const allowed = ALLOWED_TRANSITIONS[milestone.state];
  if (!allowed || !allowed.includes(toState)) {
    throw new InvalidTransitionError(milestone.id, milestone.state, toState);
  }

  // 2b. MFA Verification check
  let mfaVerified = false;
  if (toState === 'Approved' || toState === 'Funds_Released') {
    if (!mfaVerifier) {
      throw new MFARequiredError(milestone.id, toState);
    }
    if (!mfaVerifier(milestone.id, toState)) {
      throw new Error(`MFA Verification Failed: Milestone [${milestone.id}] transition to state [${toState}] rejected by verifier.`);
    }
    mfaVerified = true;
  }

  // 3. Increment Version
  const nextVersion = expectedVersion + 1;
  const previousHash = milestone.lastAuditHash || '0'.repeat(64);

  // 4. Construct Audit Ledger Block
  const blockIndex = previousBlockIndex + 1;
  const timestamp = new Date().toISOString();
  
  const mfaStamp = mfaVerified ? " [MFA Verified]" : "";
  const blockMetadata = (metadata || `Milestone state transitioned from ${milestone.state} to ${toState}`) + mfaStamp;

  const blockData: Omit<AuditTrailBlock, 'hash'> = {
    index: blockIndex,
    timestamp,
    milestoneId: milestone.id,
    fromState: milestone.state,
    toState,
    triggerUserId,
    triggerUserRole,
    metadata: blockMetadata,
    previousHash
  };

  const hash = calculateBlockHash(blockData);
  const newBlock: AuditTrailBlock = { ...blockData, hash };

  // 5. Update Milestone State
  const updatedMilestone: Milestone = {
    ...milestone,
    state: toState,
    version: nextVersion,
    lastAuditHash: hash
  };

  return { updatedMilestone, newBlock };
}

/**
 * Verifies the integrity of the cryptographic audit chain.
 */
export function verifyAuditChain(blocks: AuditTrailBlock[]): boolean {
  for (let i = 0; i < blocks.length; i++) {
    const currentBlock = blocks[i];
    
    // Check if block indices are strictly sequential
    if (currentBlock.index !== i + 1) {
      console.warn(`Audit chain invalid at block index [${i}]: Expected sequential index ${i + 1}, found ${currentBlock.index}.`);
      return false;
    }

    // Recalculate block hash
    const recomputedHash = calculateBlockHash({
      index: currentBlock.index,
      timestamp: currentBlock.timestamp,
      milestoneId: currentBlock.milestoneId,
      fromState: currentBlock.fromState,
      toState: currentBlock.toState,
      triggerUserId: currentBlock.triggerUserId,
      triggerUserRole: currentBlock.triggerUserRole,
      metadata: currentBlock.metadata,
      previousHash: currentBlock.previousHash
    });

    if (recomputedHash !== currentBlock.hash) {
      console.warn(`Audit chain invalid at block index [${i}]: Hash mismatch. Recomputed [${recomputedHash}], stored [${currentBlock.hash}].`);
      return false;
    }

    // Verify hash link to previous block
    if (i > 0) {
      const previousBlock = blocks[i - 1];
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.warn(`Audit chain link broken at index [${i}]: previousHash [${currentBlock.previousHash}] does not match previous block hash [${previousBlock.hash}].`);
        return false;
      }
    } else {
      // Genesis block previous hash check (should be all zeros or an empty genesis signature)
      if (currentBlock.previousHash !== '0'.repeat(64) && currentBlock.previousHash !== '') {
        console.warn(`Genesis block previousHash invalid. Expected zero signature hash, found [${currentBlock.previousHash}].`);
        return false;
      }
    }
  }

  return true;
}
