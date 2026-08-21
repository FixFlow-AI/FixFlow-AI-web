/**
 * Guided product tour for new CLIENT accounts.
 *
 * Mirrors the sidebar journey defined in sections/Dashboard.jsx:
 *   Overview → Brief Intelligence → AI Builder → AI Evaluation → Project Plan
 *   → Talent Matches → Agreement → Escrow Funds → Delivery Control
 *   → Payments → Outcomes
 *
 * Two tracks, deliberately split:
 *
 *  - `coreTour` is a short orientation that only ever points at things a
 *    brand-new account can actually see and act on. Every step here is
 *    reachable with zero projects created.
 *
 *  - `contextualTips` fire once, the first time the client opens that tab.
 *    Confidence scores, shortlists, escrow and payouts cannot exist until
 *    earlier work is done, so teaching them upfront would spotlight empty
 *    panels. This is why the deep steps are not in the core tour.
 *
 * Copy rule: describe what the client gets, not what the feature is called.
 *
 * `skipIf(ctx)` receives a snapshot of real store state (buildTourContext in
 * components/ProductTour.jsx). Returning true advances past the step silently.
 * Every `target` must exist as a `data-tour` attribute in the referenced file.
 */

export const TOUR_STORAGE_KEY = "ff_client_tour_v1";
// Bumped to 2: the tour was re-sequenced for the new sidebar order, so any
// saved v1 progress is intentionally invalidated and the tour replays.
export const TOUR_VERSION = 2;

export const coreTour = [
  {
    id: "welcome",
    tab: "role-onboarding",
    target: '[data-tour="role-onboarding-panel"]',
    placement: "center",
    title: "You're set up. Here's the short version.",
    tooltip:
      "Six quick stops so you know where everything lives. You can leave at any point and pick it up later from the help icon.",
    nextLabel: "Show me",
    skipIf: null,
  },
  {
    id: "company-context",
    tab: "role-onboarding",
    target: '[data-tour="client-profile-card"]',
    placement: "right",
    title: "Tell us this once",
    tooltip:
      "Company details carry into every brief, proposal and agreement you create, so you never retype your context for a new project.",
    nextLabel: "Next",
    skipIf: null,
  },
  {
    id: "nav-flow",
    tab: "role-onboarding",
    target: '[data-tour="sidebar-nav"]',
    placement: "right",
    title: "The menu is the workflow",
    tooltip:
      "It reads top to bottom in the order you'll actually use it: describe the work, plan it, choose who delivers, then protect the money.",
    nextLabel: "Next",
    // Nothing readable to point at in the icon-only collapsed rail.
    skipIf: (ctx) => ctx.sidebarCollapsed,
  },
  {
    id: "brief-intake",
    tab: "brief-intelligence",
    target: '[data-tour="brief-input"]',
    placement: "bottom",
    title: "Start by describing the work",
    tooltip:
      "Write it however you'd explain it to a colleague. No template needed — we turn it into requirements, constraints and open questions.",
    nextLabel: "Next",
    // The textarea only exists in the unparsed state; once a brief is saved
    // this panel shows the parsed view instead.
    skipIf: (ctx) => ctx.isBriefParsed,
  },
  {
    id: "ai-builder",
    tab: "proposal-generator",
    target: '[data-tour="idea-input"]',
    placement: "bottom",
    title: "Turn it into a real proposal",
    tooltip:
      "Guided discovery asks one question at a time and fills the gaps, so what comes out is scoped work with milestones, not a vague wishlist.",
    nextLabel: "Next",
    skipIf: null,
  },
  {
    id: "money-protection",
    tab: "proposal-generator",
    target: '[data-tour="nav-milestone-funds"]',
    placement: "right",
    title: "Your money stays protected",
    tooltip:
      "You fund one milestone at a time and it's only released when you accept the work. Nothing is paid out on trust alone.",
    nextLabel: "Done",
    skipIf: null,
  },
];

export const contextualTips = [
  {
    id: "brief-decisions",
    tab: "brief-intelligence",
    target: '[data-tour="brief-decisions"]',
    placement: "left",
    title: "Answer these before you hire",
    tooltip:
      "Anything ambiguous is listed here instead of surfacing halfway through delivery. Ask the question or record an assumption — both get logged.",
    nextLabel: "Got it",
    skipIf: (ctx) => ctx.decisionCount === 0,
  },
  {
    id: "evaluation",
    tab: "evidence-confidence",
    target: '[data-tour="evaluation-header"]',
    placement: "bottom",
    title: "See why a match is credible",
    tooltip:
      "Every confidence signal links back to the evidence behind it, and anything still unproven stays visible rather than averaged away.",
    nextLabel: "Got it",
    skipIf: (ctx) => !ctx.parsedProposal,
  },
  {
    id: "project-plan",
    tab: "project-plan",
    target: '[data-tour="plan-header"]',
    placement: "bottom",
    title: "Check the plan before committing",
    tooltip:
      "Phases, estimates and acceptance criteria are all editable here. Nothing becomes binding until you approve the agreement.",
    nextLabel: "Got it",
    skipIf: (ctx) => !ctx.parsedProposalId,
  },
  {
    id: "matches",
    tab: "matching",
    target: '[data-tour="matches-header"]',
    placement: "bottom",
    title: "A shortlist, not an inbox",
    tooltip:
      "You get a handful of candidates with the evidence for each, so you're comparing proven work instead of reading a hundred pitches.",
    nextLabel: "Got it",
    skipIf: (ctx) => ctx.matchingLoading,
  },
  {
    id: "agreement",
    tab: "agreement-composer",
    target: '[data-tour="agreement-header"]',
    placement: "bottom",
    title: "Agree once, in writing",
    tooltip:
      "Scope, exclusions and what counts as done are captured together, so a disagreement later has a written answer. You approve it.",
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
      "Funding a milestone signals you're serious and lets work start. The payout only happens once you accept it against the agreed criteria.",
    nextLabel: "Got it",
    skipIf: (ctx) => ctx.escrowState === "RELEASED",
  },
  {
    id: "payments",
    tab: "payment-history",
    target: '[data-tour="payments-header"]',
    placement: "bottom",
    title: "Every rupee, accounted for",
    tooltip:
      "Deposits, held funds and payouts across all your projects, each tied to the milestone it belongs to.",
    nextLabel: "Got it",
    skipIf: null,
  },
  {
    id: "outcomes",
    tab: "outcome-evidence",
    target: '[data-tour="outcomes-header"]',
    placement: "bottom",
    title: "Proof you can reuse",
    tooltip:
      "Accepted work becomes a verifiable record of what was delivered, useful for your own reporting and for future hiring decisions.",
    nextLabel: "Done",
    skipIf: null,
  },
];
