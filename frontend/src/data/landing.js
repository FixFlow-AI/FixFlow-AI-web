import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CircleDollarSign,
  Code2,
  FileCheck2,
  FileSearch,
  Fingerprint,
  GitBranch,
  ListChecks,
  MessagesSquare,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

export const audiences = [
  {
    id: "client",
    title: "Clients",
    icon: BriefcaseBusiness,
    burden:
      "Rewrite the same brief, screen noisy bids, chase proof, and arbitrate unclear scope.",
    shift:
      "Start with one structured request and receive explainable options tied to evidence.",
    outcome:
      "A defensible shortlist and a working agreement before execution begins.",
  },
  {
    id: "freelancer",
    title: "Freelancers",
    icon: UserRound,
    burden:
      "Repeat proposals, optimize profile language, accept ambiguity, and chase payment.",
    shift:
      "Reuse verified evidence and enter each project with explicit milestones and acceptance rules.",
    outcome:
      "More relevant work with less unpaid coordination and clearer payment states.",
  },
  {
    id: "agency",
    title: "Agencies",
    icon: Building2,
    burden:
      "Rebuild intake, coordinate fragmented approvals, and prove team fit repeatedly.",
    shift:
      "Standardize intake, team proof, proposal controls, and client visibility.",
    outcome:
      "A repeatable client lifecycle without losing governance or context.",
  },
  {
    id: "developer",
    title: "Developers",
    icon: Code2,
    burden:
      "Translate real engineering work into marketplace language and shallow profile signals.",
    shift:
      "Connect repositories, shipped work, and technical evidence directly to requirements.",
    outcome:
      "Relevant engineering proof carries more weight than profile optimization.",
  },
];

export const heroSteps = [
  {
    label: "Brief received",
    detail:
      "Goals, constraints, files, and open questions are captured in one intake.",
    status: "Structured",
    icon: FileSearch,
  },
  {
    label: "Proof checked",
    detail:
      "Relevant work evidence is connected to each requirement, with sources visible.",
    status: "Verified",
    icon: Fingerprint,
  },
  {
    label: "Scope agreed",
    detail:
      "Outputs, acceptance criteria, owners, assumptions, and changes become explicit.",
    status: "Approved",
    icon: FileCheck2,
  },
  {
    label: "Escrow ready",
    detail:
      "Funding state follows the approved milestone instead of living in a separate thread.",
    status: "Protected",
    icon: ShieldCheck,
  },
];

export const intelligenceStages = [
  {
    label: "Raw brief",
    short: "Intent stays visible",
    icon: MessagesSquare,
    description:
      "The original request remains attached to every interpretation that follows.",
    source:
      "“Move our billing service without interrupting existing subscriptions.”",
    finding: "Business outcome captured; migration boundaries still unclear.",
  },
  {
    label: "Parsed intelligence",
    short: "Unknowns become explicit",
    icon: ScanSearch,
    description:
      "Outcomes, constraints, dependencies, contradictions, and missing decisions are structured.",
    source: "Dependency: current payment processor webhooks and retry policy.",
    finding:
      "Risk raised: rollback ownership and data reconciliation need agreement.",
  },
  {
    label: "Proof graph",
    short: "Evidence meets requirements",
    icon: GitBranch,
    description:
      "Projects, repositories, delivery history, and domain evidence connect to requirements.",
    source:
      "Evidence source: production migration with idempotent webhook handling.",
    finding:
      "Direct evidence linked to reliability and migration requirements.",
  },
  {
    label: "Confidence grid",
    short: "Fit stays explainable",
    icon: BadgeCheck,
    description:
      "Confidence is decomposed by evidence strength, relevance, recency, and unresolved risk.",
    source:
      "Strong: migration design. Moderate: subscription reconciliation. Open: target stack.",
    finding:
      "A focused technical interview should test the remaining uncertainty.",
  },
  {
    label: "Scoped milestones",
    short: "Work becomes fundable",
    icon: ListChecks,
    description:
      "Outputs, acceptance rules, owners, timing, and funding states become one agreement.",
    source:
      "Milestone 01: migration plan, rollback design, and reconciliation test suite.",
    finding:
      "Acceptance criteria mapped to delivery evidence and escrow release.",
  },
];

export const thinkingSteps = [
  {
    label: "Intake",
    title: "Capture the whole request once.",
    description:
      "Goals, constraints, stakeholders, files, and unknowns enter one source brief.",
    signal: "4 constraints found",
    output: "Structured brief",
    icon: FileSearch,
  },
  {
    label: "Parse",
    title: "Expose risk before it becomes scope.",
    description:
      "Dependencies, contradictions, missing decisions, and scope gaps become reviewable.",
    signal: "2 open decisions",
    output: "Risk register",
    icon: ScanSearch,
  },
  {
    label: "Match",
    title: "Compare proof, not profile polish.",
    description:
      "Relevant evidence is attached to requirements so every recommendation can be inspected.",
    signal: "7 proof links",
    output: "Explainable shortlist",
    icon: Fingerprint,
  },
  {
    label: "Compose",
    title: "Turn decisions into an agreement.",
    description:
      "Assumptions, exclusions, milestones, acceptance criteria, and ownership stay connected.",
    signal: "3 milestones",
    output: "Working proposal",
    icon: FileCheck2,
  },
  {
    label: "Lock funds",
    title: "Make payment state visible early.",
    description:
      "Approved milestones connect to explicit escrow funding and release conditions.",
    signal: "Milestone 01 funded",
    output: "Protected start",
    icon: CircleDollarSign,
  },
  {
    label: "Workspace",
    title: "Keep every decision attached to the work.",
    description:
      "Files, proof, approvals, scope changes, delivery, and reputation share one timeline.",
    signal: "Context preserved",
    output: "Outcome record",
    icon: Sparkles,
  },
];

export const workflowPhases = [
  {
    id: "brief",
    label: "Brief",
    title: "The request is structured before anyone commits.",
    description:
      "Open questions are visible with the person responsible for answering them.",
    status: "2 questions open",
    owner: "Client + FixFlowAI",
    evidence: "Source brief v1.2",
  },
  {
    id: "match",
    label: "Match",
    title: "Every recommendation points to relevant proof.",
    description:
      "Evidence sources stay attached to the requirement they support.",
    status: "Proof reviewed",
    owner: "FixFlowAI + Talent",
    evidence: "Repository + delivery record",
  },
  {
    id: "agreement",
    label: "Agreement",
    title: "Scope becomes an inspectable working agreement.",
    description:
      "Outputs, acceptance rules, assumptions, owners, and funding states are explicit.",
    status: "Ready for approval",
    owner: "Client + Talent",
    evidence: "Milestone plan v2.0",
  },
  {
    id: "build",
    label: "Build",
    title: "Delivery events keep their project context.",
    description:
      "Progress, files, decisions, and scope changes remain connected to the agreement.",
    status: "In progress",
    owner: "Talent",
    evidence: "Delivery branch + change log",
  },
  {
    id: "approval",
    label: "Approval",
    title: "Acceptance is checked against agreed criteria.",
    description:
      "A client can accept, request a revision, or raise a scoped change with evidence.",
    status: "Review required",
    owner: "Client",
    evidence: "3 acceptance criteria",
  },
  {
    id: "outcome",
    label: "Outcome",
    title: "Payment and reputation follow the accepted result.",
    description:
      "Released funds and evidence-backed reputation close the loop.",
    status: "Recorded",
    owner: "Escrow + FixFlowAI",
    evidence: "Accepted outcome event",
  },
];

export const automationRows = [
  {
    work: "Proposal rebuilding",
    before: "Start from a blank document and repeat discovery context.",
    automation:
      "Assemble a proposal structure from the brief and relevant proof.",
    control: "Edit assumptions, pricing, milestones, and exclusions.",
  },
  {
    work: "Client follow-up",
    before: "Chase missing inputs across email, chat, and calls.",
    automation:
      "Request missing inputs in the portal and record each decision.",
    control: "Approve the final agreement and every scoped change.",
  },
  {
    work: "Payment chasing",
    before: "Reconcile invoices, messages, delivery, and approval manually.",
    automation: "Keep escrow state connected to approved milestones.",
    control: "Funding and release still follow explicit human approval rules.",
  },
  {
    work: "Context switching",
    before: "Reconstruct the latest truth from disconnected tools.",
    automation: "Link files, messages, proof, decisions, and delivery events.",
    control: "Participants choose what becomes contractual evidence.",
  },
  {
    work: "Reputation rebuilding",
    before: "Explain the same outcome from scratch on every platform.",
    automation: "Turn accepted outcomes into structured proof events.",
    control: "Review what becomes public or remains private.",
  },
];

export const trustEvents = [
  [
    "Requirement captured",
    "Billing migration must preserve active subscription state.",
  ],
  [
    "Risk acknowledged",
    "Rollback ownership and reconciliation policy confirmed.",
  ],
  ["Proof connected", "Repository linked to webhook reliability requirement."],
  [
    "Agreement signed",
    "Three milestones approved with explicit acceptance rules.",
  ],
  ["Milestone funded", "Escrow confirms funds before implementation begins."],
  ["Delivery submitted", "Code, test evidence, and migration notes attached."],
  ["Outcome accepted", "Milestone accepted against all three criteria."],
  [
    "Reputation updated",
    "Verified migration outcome added to the evidence trail.",
  ],
];

export const roleMessages = {
  client:
    "Structure a project request, compare proof, and approve protected milestones.",
  freelancer:
    "Reuse verified work evidence and start projects with clearer agreements.",
  agency:
    "Standardize intake, team proof, proposal governance, and client visibility.",
  developer:
    "Let repositories and shipped engineering work support each recommendation.",
};

// Concrete, truthful product metrics used as trust signals on the landing
// page. These map to the FixFlowAI UVPs (zero-noise shortlist, instant
// matching, protected-by-default escrow, immutable audit trail) rather than
// fabricated customer counts, which would be dishonest for an early-access
// product.
export const proofStats = [
  {
    value: "<60s",
    label: "Brief to structured requirements",
    detail: "Unstructured intent becomes outcomes, constraints, and open decisions.",
  },
  {
    value: "Top 3–5",
    label: "Zero-noise shortlist",
    detail: "Explainable matches tied to evidence instead of open-bidding spam.",
  },
  {
    value: "100%",
    label: "Milestones funded before build",
    detail: "Escrow confirms protected funds before any work begins.",
  },
  {
    value: "SHA-256",
    label: "Chained audit trail",
    detail: "Every state change is cryptographically verifiable for both sides.",
  },
];

// Capability badges shown alongside the stats as a lightweight "trusted by
// design" row in place of partner logos for an early-access product.
export const proofBadges = [
  "Evidence-linked matching",
  "Finite-state escrow",
  "Shared decision history",
  "Verifiable reputation",
];
