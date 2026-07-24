import { randomUUID } from 'crypto';
import {
  Milestone,
  MilestoneState,
  UserRole,
  AuditTrailBlock,
  transitionMilestone,
  verifyAuditChain,
  MFARequiredError,
} from '../skills/escrowStateMachine.js';
import { getMilestoneRepository } from './milestoneRepository.js';
import { verifyOtp } from '../auth/otpVerifier.js';
import { getUserRepository } from './userRepository.js';

/**
 * Escrow service — orchestrates the pure FSM (escrowStateMachine.ts) with a
 * persistence layer (milestoneRepository.ts). State lives in DynamoDB (or an
 * in-memory store for local dev), never in this module, so it survives across
 * Lambda cold starts and multiple instances.
 */

export interface CreateMilestoneInput {
  proposalId: string;
  title: string;
  amount: number;
}

export async function createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
  const milestone: Milestone = {
    id: randomUUID(),
    proposalId: input.proposalId,
    title: input.title,
    amount: input.amount,
    state: 'Draft',
    version: 0,
    lastAuditHash: '',
  };
  await getMilestoneRepository().create(milestone);
  return milestone;
}

export async function getMilestone(id: string): Promise<Milestone | null> {
  return getMilestoneRepository().get(id);
}

export async function listMilestones(proposalId?: string): Promise<Milestone[]> {
  return getMilestoneRepository().list(proposalId);
}

export interface TransitionInput {
  toState: MilestoneState;
  triggerUserId: string;
  triggerUserRole: UserRole;
  expectedVersion: number;
  metadata?: string;
  /** Any non-empty token satisfies the MFA gate for Approved / Funds_Released. */
  mfaToken?: string;
}

export async function applyTransition(
  id: string,
  input: TransitionInput,
): Promise<{ milestone: Milestone; block: AuditTrailBlock }> {
  const repo = getMilestoneRepository();
  const milestone = await repo.get(id);
  if (!milestone) {
    throw new Error(`Milestone [${id}] not found.`);
  }

  const chain = await repo.getAuditBlocks(id);
  const previousBlockIndex = chain.length;

  // Verify MFA token asynchronously before invoking transition (BUG-06)
  if (input.toState === 'Approved' || input.toState === 'Funds_Released') {
    if (!input.mfaToken || !input.mfaToken.trim()) {
      throw new MFARequiredError(id, input.toState);
    }
    const user = await getUserRepository().findById(input.triggerUserId);
    if (!user || !user.otpSecret || !verifyOtp(input.mfaToken, user.otpSecret)) {
      throw new Error(`MFA Verification Failed: Milestone [${id}] transition to state [${input.toState}] rejected by verifier.`);
    }
  }

  // FSM verification check is pre-satisfied by the service layer checks above
  const mfaVerifier = (_mid: string, _state: MilestoneState) => true;

  const { updatedMilestone, newBlock } = transitionMilestone(
    milestone,
    input.toState,
    input.triggerUserId,
    input.triggerUserRole,
    input.expectedVersion,
    previousBlockIndex,
    input.metadata,
    mfaVerifier,
  );

  await repo.saveWithAuditBlock(updatedMilestone, newBlock);

  return { milestone: updatedMilestone, block: newBlock };
}

export async function getAuditChain(
  id: string,
): Promise<{ blocks: AuditTrailBlock[]; valid: boolean }> {
  const blocks = await getMilestoneRepository().getAuditBlocks(id);
  return { blocks, valid: verifyAuditChain(blocks) };
}

export interface AuditScanResult {
  scannedAt: string;
  totalMilestones: number;
  validChains: number;
  invalidChains: number;
  tampered: Array<{ milestoneId: string; blocks: number }>;
}

/**
 * STORY-21: Verifies the SHA-256 audit chain of every persisted milestone and
 * reports any tampering. Intended to run on a schedule (cron / EventBridge) or
 * on-demand via an admin route. Emits a CRITICAL log for each mismatch so
 * external alerting (e.g. CloudWatch metric filter) can page an operator.
 */
export async function scanAllAuditChains(): Promise<AuditScanResult> {
  const repo = getMilestoneRepository();
  const milestones = await repo.list();
  const tampered: Array<{ milestoneId: string; blocks: number }> = [];

  for (const m of milestones) {
    const blocks = await repo.getAuditBlocks(m.id);
    if (!verifyAuditChain(blocks)) {
      tampered.push({ milestoneId: m.id, blocks: blocks.length });
      console.error(
        `[AUDIT-SCAN][CRITICAL] Tampered or broken audit chain detected for milestone [${m.id}] (${blocks.length} blocks). Investigate immediately.`,
      );
    }
  }

  const result: AuditScanResult = {
    scannedAt: new Date().toISOString(),
    totalMilestones: milestones.length,
    validChains: milestones.length - tampered.length,
    invalidChains: tampered.length,
    tampered,
  };

  console.log(
    `[AUDIT-SCAN] Completed: ${result.validChains}/${result.totalMilestones} chains valid, ${result.invalidChains} tampered.`,
  );
  return result;
}
