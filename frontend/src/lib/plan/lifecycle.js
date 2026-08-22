/**
 * Project lifecycle derivation (pure — no React, no DOM).
 *
 * Turns the four pieces of persisted project state into one ordered walk from
 * brief to released funds, so the client can see the process they are
 * committing to and where their project currently sits (Requirement 8.1).
 *
 * The stage descriptions and gates are not invented: they mirror the real
 * server-side state machines.
 *   - `backend/src/services/clientMatchWorkflow.ts` — `ACTION_ROLES.accept` is
 *     `['freelancer']`, and `invited` only exits via the freelancer's own
 *     `accept` / `decline`. A client can never hire someone who never agreed.
 *   - `backend/src/skills/escrowStateMachine.ts` — `ALLOWED_TRANSITIONS`
 *     reaches `Funds_Released` **only** from `Approved`, and `In_Review`
 *     reaches `Approved` only through the client's acceptance. Payout therefore
 *     always follows client acceptance.
 *   - `backend/src/services/proposalWorkflow.ts` — the proposal builder is five
 *     sequentially approved steps.
 *   - `backend/src/services/proposalPlanRepository.ts` — plan status is
 *     `draft | in_review | approved | superseded`.
 *
 * Invariants guaranteed for *any* input, however malformed (Property 13):
 *   - the full ordered stage list is always returned, one entry per stage;
 *   - exactly one stage is `current`;
 *   - every stage before it is `done`;
 *   - every stage after it is `upcoming` or `blocked`, never `done`;
 *   - every stage carries a non-empty `what`, `owner`, and `advancedBy`;
 *   - the hiring stages are `done` only when the match workflow records the
 *     freelancer's own acceptance;
 *   - the funds stages are `done` only when a milestone reached client approval.
 *
 * @module lib/plan/lifecycle
 */

/**
 * One stage of the project lifecycle as returned by {@link deriveLifecycle}.
 *
 * @typedef {Object} LifecycleStage
 * @property {string} id Stable identifier, unique within the list.
 * @property {string} label Short human label for the stage.
 * @property {string} what What happens during the stage.
 * @property {string} owner Who is responsible while the project sits here.
 * @property {string} advancedBy The action that moves the project onward.
 * @property {?{holder: string, rule: string}} gate Who holds the blocking
 *   decision and the rule that enforces it, or `null` when the stage is not
 *   decision-gated.
 * @property {'done'|'current'|'upcoming'|'blocked'} state Where the project is
 *   relative to this stage.
 */

/**
 * Inputs to {@link deriveLifecycle}. Every field is optional — a project that
 * has only just started has none of them.
 *
 * @typedef {Object} LifecycleInput
 * @property {?{activeStep: number, approvedSteps: number[]}} [workflow]
 *   Proposal builder progress, as persisted by `sanitizeWorkflow`.
 * @property {?string} [planStatus] `draft | in_review | approved | superseded`.
 * @property {?{candidates: Array<Object>, auditTrail: Array<Object>}} [matchWorkflow]
 *   Client hiring workflow, including its chained audit trail.
 * @property {?Array<{state: string}>} [milestones] Escrow milestones.
 */

/**
 * Total steps in the sequential proposal builder (Describe → Scope →
 * Intelligence → Timeline → Review). Mirrors `PROPOSAL_TOTAL_STEPS` in
 * `backend/src/services/proposalWorkflow.ts`.
 * @type {number}
 */
export const PROPOSAL_TOTAL_STEPS = 5;

/**
 * The project lifecycle, in order. Frozen: {@link deriveLifecycle} returns
 * copies so callers can never corrupt the template.
 *
 * @type {ReadonlyArray<Omit<LifecycleStage, 'state'>>}
 */
export const LIFECYCLE_STAGES = Object.freeze(
  [
    {
      id: 'brief',
      label: 'Brief',
      what: 'You describe the project in your own words — the outcome you want, the constraints you are under, and anything already decided.',
      owner: 'Client',
      advancedBy: 'Approving the Describe step of the proposal builder',
      gate: null,
    },
    {
      id: 'proposal',
      label: 'Proposal',
      what: 'Your brief is turned into a structured proposal — scope, deliverables, timeline, and pricing — which you approve one step at a time.',
      owner: 'Client, with FixFlowAI drafting',
      advancedBy: `Approving all ${PROPOSAL_TOTAL_STEPS} steps of the proposal builder`,
      gate: null,
    },
    {
      id: 'plan',
      label: 'Execution plan',
      what: 'A dated execution plan is generated from the approved proposal, then re-checked by the deterministic validator before you ever see it.',
      owner: 'FixFlowAI',
      advancedBy: 'Putting the generated plan up for your review',
      gate: null,
    },
    {
      id: 'agreement',
      label: 'Agreement',
      what: 'You review the plan and approve it, fixing scope, milestones, and money before anyone is hired or paid.',
      owner: 'Client',
      advancedBy: 'Approving the execution plan',
      gate: {
        holder: 'Client',
        rule: 'Only you can approve the plan, and an approved plan has to be reopened before it can be edited again.',
      },
    },
    {
      id: 'invite',
      label: 'Invitation',
      what: 'You invite shortlisted candidates to the project. An invitation is an offer, not a hire.',
      owner: 'Client',
      advancedBy: 'Sending an invitation to a shortlisted candidate',
      gate: null,
    },
    {
      id: 'freelancer_accepts',
      label: 'Freelancer accepts',
      what: 'The invited freelancer decides whether to take the project on. Nothing moves while the invitation is unanswered.',
      owner: 'Freelancer',
      advancedBy: "The freelancer's own acceptance of the invitation",
      gate: {
        holder: 'Freelancer',
        rule: 'Only the freelancer can accept an invitation — you cannot accept on their behalf, so nobody is ever hired without their own consent.',
      },
    },
    {
      id: 'hired',
      label: 'Hired',
      what: 'With consent given, you select the freelancer who accepted and the delivery team for the project is settled.',
      owner: 'Client',
      advancedBy: 'Selecting a candidate who has already accepted',
      gate: {
        holder: 'Client',
        rule: 'Only a candidate who has already accepted can be interviewed or selected.',
      },
    },
    {
      id: 'funded',
      label: 'Funded',
      what: 'You deposit a milestone into escrow. The money is held, not paid, and work starts only against funded milestones.',
      owner: 'Client',
      advancedBy: 'Depositing a milestone into escrow',
      gate: {
        holder: 'Client',
        rule: 'A milestone waits in Pending_Deposit until your payment is confirmed; it only becomes Active once the funds are held.',
      },
    },
    {
      id: 'in_review',
      label: 'In review',
      what: 'The freelancer delivers the funded milestone and submits it, with its evidence, for your review.',
      owner: 'Freelancer',
      advancedBy: 'The freelancer submitting the milestone for review',
      gate: null,
    },
    {
      id: 'client_accepts',
      label: 'Client accepts',
      what: 'You review the delivered work and either accept it or send it back for a revision.',
      owner: 'Client',
      advancedBy: 'Approving the submitted milestone',
      gate: {
        holder: 'Client',
        rule: 'A milestone can only reach Approved from In_Review through your acceptance — you can request a revision instead.',
      },
    },
    {
      id: 'funds_released',
      label: 'Funds released',
      what: 'The escrowed amount for the accepted milestone is paid out to the freelancer.',
      owner: 'FixFlowAI',
      advancedBy: 'Releasing the approved milestone to the freelancer',
      gate: {
        holder: 'Client',
        rule: 'Funds_Released is reachable only from Approved, so a payout always follows your acceptance.',
      },
    },
  ].map((stage) => Object.freeze({ ...stage, gate: stage.gate ? Object.freeze(stage.gate) : null })),
);

/** Match statuses that can only have been reached via an invitation. */
const INVITED_OR_LATER = new Set(['invited', 'accepted', 'declined', 'interviewing', 'selected']);

/**
 * Milestone states that can only be reached once the client's deposit was
 * captured. `Dispute` is included because it is only reachable from `Active`
 * or `In_Review`, both of which are post-funding.
 */
const FUNDED_STATES = new Set(['Active', 'In_Review', 'Revision_Requested', 'Approved', 'Funds_Released', 'Dispute']);

/** Milestone states that can only be reached after a submission for review. */
const REVIEWED_STATES = new Set(['In_Review', 'Revision_Requested', 'Approved', 'Funds_Released']);

/** Milestone states that can only be reached through the client's acceptance. */
const CLIENT_ACCEPTED_STATES = new Set(['Approved', 'Funds_Released']);

/**
 * Count the contiguous approved prefix of the proposal builder.
 *
 * Mirrors `sanitizeWorkflow`: approving step 3 without 1 and 2 is not a valid
 * state, so only the prefix starting at 1 counts as progress.
 *
 * @param {unknown} approvedSteps
 * @returns {number} How many leading steps (1, 2, 3, …) are approved.
 */
function approvedPrefixLength(approvedSteps) {
  if (!Array.isArray(approvedSteps)) return 0;
  const unique = [
    ...new Set(approvedSteps.filter((n) => Number.isInteger(n) && n >= 1 && n <= PROPOSAL_TOTAL_STEPS)),
  ].sort((a, b) => a - b);
  let length = 0;
  while (length < unique.length && unique[length] === length + 1) length += 1;
  return length;
}

/**
 * Freelancer ids for which the workflow records the freelancer's *own*
 * acceptance.
 *
 * A candidate sitting at `status: 'accepted'` is not sufficient evidence on its
 * own — only an audit entry whose action is `accept` and whose `triggerRole` is
 * `freelancer` proves the consent gate was actually passed by the freelancer.
 *
 * @param {unknown} matchWorkflow
 * @returns {Set<string>}
 */
function freelancersWhoAccepted(matchWorkflow) {
  const trail = matchWorkflow && Array.isArray(matchWorkflow.auditTrail) ? matchWorkflow.auditTrail : [];
  const accepted = new Set();
  for (const entry of trail) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.action !== 'accept' || entry.triggerRole !== 'freelancer') continue;
    if (typeof entry.freelancerId === 'string' && entry.freelancerId.length > 0) accepted.add(entry.freelancerId);
  }
  return accepted;
}

/**
 * Candidate list of a match workflow, tolerating any malformed shape.
 *
 * @param {unknown} matchWorkflow
 * @returns {Array<Object>}
 */
function candidatesOf(matchWorkflow) {
  if (!matchWorkflow || typeof matchWorkflow !== 'object') return [];
  return Array.isArray(matchWorkflow.candidates)
    ? matchWorkflow.candidates.filter((candidate) => candidate && typeof candidate === 'object')
    : [];
}

/**
 * Whether any milestone sits in one of the given states.
 *
 * @param {unknown} milestones
 * @param {Set<string>} states
 * @returns {boolean}
 */
function anyMilestoneIn(milestones, states) {
  if (!Array.isArray(milestones)) return false;
  return milestones.some((milestone) => milestone && typeof milestone === 'object' && states.has(milestone.state));
}

/**
 * Evidence that each stage has been *completed*, in lifecycle order.
 *
 * Each entry is a hard requirement, so a stage can never be reported as done
 * without the state that proves it.
 *
 * @param {LifecycleInput} input
 * @returns {boolean[]} One flag per entry of {@link LIFECYCLE_STAGES}.
 */
function stageCompletion({ workflow, planStatus, matchWorkflow, milestones }) {
  const wf = workflow && typeof workflow === 'object' ? workflow : {};
  const approved = approvedPrefixLength(wf.approvedSteps);
  const activeStep = Number.isInteger(wf.activeStep) ? wf.activeStep : 1;

  const status = typeof planStatus === 'string' ? planStatus : '';
  const candidates = candidatesOf(matchWorkflow);
  const acceptedIds = freelancersWhoAccepted(matchWorkflow);

  const invitationIssued =
    candidates.some((candidate) => INVITED_OR_LATER.has(candidate.status)) || acceptedIds.size > 0;

  // Only a candidate who personally accepted can count as hired — this is the
  // freelancer consent gate, restated on the read side.
  const hired = candidates.some(
    (candidate) => candidate.status === 'selected' && acceptedIds.has(candidate.freelancerId),
  );

  return [
    approved >= 1 || activeStep > 1, // brief described
    approved >= PROPOSAL_TOTAL_STEPS, // whole proposal approved
    status === 'in_review' || status === 'approved', // plan authored and up for review
    status === 'approved', // agreement reached
    invitationIssued,
    acceptedIds.size > 0, // freelancer's own acceptance recorded
    hired,
    anyMilestoneIn(milestones, FUNDED_STATES),
    anyMilestoneIn(milestones, REVIEWED_STATES),
    anyMilestoneIn(milestones, CLIENT_ACCEPTED_STATES),
    anyMilestoneIn(milestones, new Set(['Funds_Released'])),
  ];
}

/**
 * Derive the ordered lifecycle for a project, marking where it currently sits.
 *
 * Progress is read as a prefix: the project occupies the first stage whose
 * completion evidence is missing. Later evidence never back-fills an earlier
 * gap, so the walk can never claim a stage the project skipped
 * (Requirement 8.6). The last stage is the furthest the project can be said to
 * occupy, so it is reported as `current` once reached rather than `done`.
 *
 * The stage immediately after the current one is reported as `blocked` when it
 * is decision-gated: it cannot start until its `gate.holder` acts.
 *
 * Every input is optional and every malformed input is tolerated —
 * `deriveLifecycle()` describes a project that has only just begun.
 *
 * @param {LifecycleInput} [input]
 * @returns {{stages: LifecycleStage[], currentStageId: string}}
 *
 * @example
 * deriveLifecycle({ planStatus: 'approved', workflow: { activeStep: 5, approvedSteps: [1, 2, 3, 4, 5] } });
 * // → currentStageId: 'invite', with brief…agreement done and
 * //   'freelancer_accepts' blocked on the freelancer.
 */
export function deriveLifecycle(input) {
  const safeInput = input && typeof input === 'object' ? input : {};
  const completion = stageCompletion(safeInput);

  const lastIndex = LIFECYCLE_STAGES.length - 1;
  let currentIndex = completion.findIndex((done) => !done);
  if (currentIndex === -1 || currentIndex > lastIndex) currentIndex = lastIndex;

  const stages = LIFECYCLE_STAGES.map((stage, index) => {
    let state;
    if (index < currentIndex) state = 'done';
    else if (index === currentIndex) state = 'current';
    else if (index === currentIndex + 1 && stage.gate) state = 'blocked';
    else state = 'upcoming';

    return { ...stage, gate: stage.gate ? { ...stage.gate } : null, state };
  });

  return { stages, currentStageId: stages[currentIndex].id };
}
