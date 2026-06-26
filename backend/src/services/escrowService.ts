import { randomUUID } from 'crypto';
import {
  Milestone,
  MilestoneState,
  UserRole,
  AuditTrailBlock,
  transitionMilestone,
  verifyAuditChain,
} from '../skills/escrowStateMachine.js';

/**
 * In-memory escrow service.
 *
 * Wraps the stateless escrow FSM (escrowStateMachine.ts) with a process-local
 * store so milestones and their cryptographic audit chains can be created,
 * transitioned, and inspected over HTTP. In production this map would be backed
 * by PostgreSQL/Prisma, but the FSM logic and audit guarantees are identical.
 */

const milestones = new Map<string, Milestone>();
const auditChains = new Map<string, AuditTrailBlock[]>();

export interface CreateMilestoneInput {
  proposalId: string;
  title: string;
  amount: number;
}

export function createMilestone(input: CreateMilestoneInput): Milestone {
  const id = randomUUID();
  const milestone: Milestone = {
    id,
    proposalId: input.proposalId,
    title: input.title,
    amount: input.amount,
    state: 'Draft',
    version: 0,
    lastAuditHash: '',
  };
  milestones.set(id, milestone);
  auditChains.set(id, []);
  return milestone;
}

export function getMilestone(id: string): Milestone | undefined {
  return milestones.get(id);
}

export function listMilestones(proposalId?: string): Milestone[] {
  const all = Array.from(milestones.values());
  return proposalId ? all.filter((m) => m.proposalId === proposalId) : all;
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

export function applyTransition(
  id: string,
  input: TransitionInput,
): { milestone: Milestone; block: AuditTrailBlock } {
  const milestone = milestones.get(id);
  if (!milestone) {
    throw new Error(`Milestone [${id}] not found.`);
  }

  const chain = auditChains.get(id) ?? [];
  const previousBlockIndex = chain.length;

  const mfaVerifier = (_mid: string, _state: MilestoneState) =>
    Boolean(input.mfaToken && input.mfaToken.trim());

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

  milestones.set(id, updatedMilestone);
  auditChains.set(id, [...chain, newBlock]);

  return { milestone: updatedMilestone, block: newBlock };
}

export function getAuditChain(id: string): { blocks: AuditTrailBlock[]; valid: boolean } {
  const blocks = auditChains.get(id) ?? [];
  return { blocks, valid: verifyAuditChain(blocks) };
}

/** Reset helper for tests / demos. */
export function resetEscrowStore(): void {
  milestones.clear();
  auditChains.clear();
}
