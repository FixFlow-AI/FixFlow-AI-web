/**
 * Sequential-approval sanitisation for the proposal builder.
 *
 * Extracted from `src/index.ts` so it can be exercised directly by
 * `src/test/testProposalWorkflow.ts` — importing `index.ts` would bind the HTTP
 * port and start the keep-alive service as a side effect. `index.ts` imports
 * and re-exports these symbols, so the route behaviour is unchanged.
 */
import type { ProposalWorkflow } from './proposalRepository.js';

// Total steps in the sequential proposal builder (Describe → Scope →
// Intelligence → Timeline → Review). Kept in sync with the frontend stepper.
export const PROPOSAL_TOTAL_STEPS = 5;

/**
 * Coerce a client-supplied workflow into a logically valid one:
 * - approvedSteps must be a contiguous prefix starting at 1 (you cannot approve
 *   step 3 without having approved 1 and 2);
 * - activeStep is clamped to [1, TOTAL] and can be at most (highest approved + 1).
 * This makes the persisted state tamper-resistant regardless of client input.
 */
export function sanitizeWorkflow(activeStep: unknown, approvedSteps: unknown): ProposalWorkflow {
  const uniq = Array.isArray(approvedSteps)
    ? [...new Set(approvedSteps.filter((n) => Number.isInteger(n) && n >= 1 && n <= PROPOSAL_TOTAL_STEPS))].sort(
        (a, b) => a - b,
      )
    : [];
  const prefix: number[] = [];
  for (let i = 0; i < uniq.length; i++) {
    if (uniq[i] === i + 1) prefix.push(uniq[i]);
    else break;
  }
  const maxAllowed = Math.min((prefix.length ? prefix[prefix.length - 1] : 0) + 1, PROPOSAL_TOTAL_STEPS);
  let step = Number.isInteger(activeStep) ? (activeStep as number) : 1;
  step = Math.min(Math.max(step, 1), maxAllowed);
  return { activeStep: step, approvedSteps: prefix, updatedAt: new Date().toISOString() };
}
