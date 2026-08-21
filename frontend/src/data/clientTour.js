/**
 * Guided product tour configuration for new CLIENT accounts.
 *
 * Two tracks:
 *  - `coreTour`        runs once, immediately after signup, as a linear walkthrough.
 *  - `contextualTips`  fire individually the first time a client opens that tab,
 *                      because several surfaces (escrow, payments) cannot exist
 *                      until earlier steps are done. Teaching them upfront would
 *                      point at empty panels.
 *
 * `skipIf(ctx)` receives a snapshot of real store state (see buildTourContext in
 * components/ProductTour.jsx). Returning true advances past the step silently.
 *
 * Every `target` must exist as a `data-tour` attribute in the referenced file.
 */

export const TOUR_STORAGE_KEY = "ff_client_tour_v1";
export const TOUR_VERSION = 1;

export const coreTour = [
  {
    id: "welcome",
    tab: "role-onboarding",
    target: '[data-tour="role-onboarding-panel"]',
    placement: "center",
    title: "Welcome to your workspace",
    tooltip:
      "We'll walk through turning one project idea into a funded, protected agreement. About a minute, and you can leave any time.",
    nextLabel: "Start tour",
    skipIf: null,
  },
  {
    id: "company-context",
    tab: "role-onboarding",
    target: '[data-tour="client-profile-card"]',
    placement: "right",
    title: "Set your context once",
    tooltip:
      "Fill this in once and it carries into every proposal and agreement, so you never re-explain who you are or how you work.",
    nextLabel: "Next",
    skipIf: null,
  },
  {
    id: "nav-orientation",
    tab: "role-onboarding",
    target: '[data-tour="sidebar-nav"]',
    placement: "right",
    title: "How a project moves",
    tooltip:
      "Your project runs top to bottom: build the brief, evaluate it, match talent, agree on scope, then release funds against delivery.",
    nextLabel: "Next",
    // Nothing useful to point at when the sidebar is collapsed to icons.
    skipIf: (ctx) => ctx.sidebarCollapsed,
  },
  {
    id: "create-project",
    tab: "proposal-generator",
    target: '[data-tour="idea-input"]',
    placement: "bottom",
    title: "Start with a plain description",
    tooltip:
      "Describe what you want built in your own words. No template, no spec, no formatting rules — structure comes next.",
    nextLabel: "Next",
    skipIf: (ctx) => Boolean(ctx.parsedProposalId),
  },
  {
    id: "clarifying-questions",
    tab: "proposal-generator",
    target: '[data-tour="discovery-start"]',
    placement: "top",
    title: "Guided discovery fills the gaps",
    tooltip:
      "Instead of one long form, the agent asks a question at a time and adapts to your answers until the brief is complete.",
    nextLabel: "Next",
    skipIf: (ctx) => ctx.isBriefParsed,
  },
  {
    id: "ai-briefing",
    tab: "brief-intelligence",
    target: '[data-tour="parsed-requirements"]',
    placement: "left",
    title: "Your brief becomes structure",
    tooltip:
      "Outcomes, constraints, and open decisions are extracted here, and each one stays traceable back to what you originally wrote.",
    nextLabel: "Next",
    skipIf: (ctx) => !ctx.isBriefParsed || ctx.briefParsing,
  },
  {
    id: "open-decisions",
    tab: "brief-intelligence",
    target: '[data-tour="brief-decisions"]',
    placement: "left",
    title: "Ambiguity surfaces early",
    tooltip:
      "Unclear items appear here instead of mid-project. Request clarification or record an assumption — either way the choice is logged.",
    nextLabel: "Finish",
    skipIf: (ctx) => ctx.decisionCount === 0,
  },
];

export const contextualTips = [
  {
    id: "evaluation",
    tab: "evidence-confidence",
    target: '[data-tour="evaluation-header"]',
    placement: "bottom",
    title: "Confidence you can inspect",
    tooltip:
      "Fit is broken down by evidence strength and what is still unresolved, rather than collapsed into a single opaque score.",
    nextLabel: "Got it",
    skipIf: (ctx) => !ctx.parsedProposal,
  },
  {
    id: "matches",
    tab: "matching",
    target: '[data-tour="matches-header"]',
    placement: "bottom",
    title: "A shortlist, not a bid pile",
    tooltip:
      "Each match points to the evidence behind it. Your invitations and selection decisions are saved with the project.",
    nextLabel: "Got it",
    skipIf: (ctx) => ctx.matchingLoading,
  },
  {
    id: "proposal-review",
    tab: "project-plan",
    target: '[data-tour="plan-header"]',
    placement: "bottom",
    title: "Review before you commit",
    tooltip:
      "Scope, phases, and acceptance criteria are all editable here. Nothing becomes binding until you approve the agreement.",
    nextLabel: "Got it",
    skipIf: (ctx) => !ctx.parsedProposalId,
  },
  {
    id: "agreement",
    tab: "agreement-composer",
    target: '[data-tour="agreement-header"]',
    placement: "bottom",
    title: "Scope becomes an agreement",
    tooltip:
      "Assumptions, exclusions, and acceptance rules become the agreement both sides sign. Final approval stays with you.",
    nextLabel: "Got it",
    skipIf: (ctx) => ctx.agreementStatus === "approved",
  },
  {
    id: "escrow",
    tab: "milestone-funds",
    target: '[data-tour="escrow-header"]',
    placement: "bottom",
    title: "Funds are held, not sent",
    tooltip:
      "Funding a milestone lets work start. The money is only released when you accept the delivery against the agreed criteria.",
    nextLabel: "Got it",
    skipIf: (ctx) => ctx.escrowState === "RELEASED",
  },
  {
    id: "payments",
    tab: "payment-history",
    target: '[data-tour="payments-header"]',
    placement: "bottom",
    title: "One ledger for everything",
    tooltip:
      "Every deposit, escrow hold, and payout across your projects, each tied to the milestone it belongs to.",
    nextLabel: "Done",
    skipIf: null,
  },
];
