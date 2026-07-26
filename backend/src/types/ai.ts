/**
 * Shared AI types for the TypeScript gateway.
 *
 * The LLM features themselves live in the Python AI service (`ai-service/`).
 * The gateway only needs the *shapes* of the data it proxies and persists, so
 * these are plain TypeScript interfaces (no Zod / no Gemini dependency).
 *
 * Keep these in sync with `ai-service/app/schemas/*` — they are the contract.
 */

export interface Feature {
  title: string;
  description: string;
  technical_approach: string;
  complexity: 'High' | 'Medium' | 'Low';
  confidence: 'High' | 'Medium' | 'Low';
  confidence_pct: number;
  area: string;
}

export interface Risk {
  label: string;
  severity: number;
  mitigation: string;
  category: string;
}

export interface TimelinePhase {
  phase: string;
  duration: string;
  tasks: string[];
  dependencies: string[];
}

export interface DeliveryTask {
  id: string;
  title: string;
  owner: 'team' | 'client' | 'shared';
  status: 'planned' | 'done' | 'backlog';
  notify: boolean;
}

export interface DeliveryWeek {
  id: string;
  label: string;
  startWeek: number;
  endWeek: number;
  sourcePhase: string;
  goals: string[];
  tasks: DeliveryTask[];
  deliverables: string[];
  dependencies: string[];
}

export interface RoadmapItem {
  id: string;
  title: string;
  targetWeek: number;
  sourceWeekIds: string[];
  status: 'planned' | 'done';
}

export interface BacklogItem {
  id: string;
  title: string;
  sourceWeekId: string | null;
  reason: 'timeline_overflow' | 'future_enhancement' | 'dependency_blocked';
  status: 'backlog';
}

export interface NotificationDefaults {
  enabled: boolean;
  channels: Array<'in_app' | 'email'>;
  events: Array<'invite' | 'comment' | 'approval' | 'assignment' | 'goal_completed' | 'backlog_moved'>;
}

export interface DeliveryPlan {
  mode: 'weekly';
  generatedFrom: 'llm' | 'derived';
  weeks: DeliveryWeek[];
  roadmap: RoadmapItem[];
  backlog: BacklogItem[];
  notificationDefaults: NotificationDefaults;
}

export interface Effort {
  label: string;
  percentage: number;
  timeframe: string;
  description: string;
}

export interface MarketItem {
  title: string;
  description: string;
  trend: 'up' | 'down' | 'stable';
  relevance: number;
}

export interface ImpactItem {
  title: string;
  description: string;
  impact_score: number;
  category: string;
}

export interface Proposal {
  project_summary: string;
  features: Feature[];
  risks: Risk[];
  timeline: TimelinePhase[];
  delivery_plan: DeliveryPlan;
  effort: Effort[];
  market: MarketItem[];
  impact: ImpactItem[];
  /**
   * AI-008 (v2): optional deep, editable execution plan. Absent on every v1
   * proposal — the gateway keeps reading `timeline`/`delivery_plan` unchanged.
   */
  executionPlan?: ExecutionPlan;
}

// ---- AI-008: v2 Execution Plan (deep proposal / editable timeline) ----
// Mirrors ai-service/app/schemas/execution_plan.py. Every cross-reference is a
// stable ID. Deterministic fields (diagnostics, capacity, coverage, severity)
// are computed/validated by the backend + AI service, never authored by the LLM.

export type PlanPriority = 'must' | 'should' | 'could';
export type PlanTaskStatus = 'planned' | 'in_progress' | 'blocked' | 'done' | 'backlog';
export type CheckpointType =
  | 'design_review'
  | 'demo'
  | 'client_approval'
  | 'security_review'
  | 'release_readiness';
export type CheckpointStatus = 'planned' | 'ready_for_review' | 'approved' | 'changes_requested';
export type DiagnosticSeverity = 'error' | 'warning' | 'info';

export interface Assumption {
  id: string;
  statement: string;
  impact?: string | null;
  category?: string | null;
}

export interface OpenQuestion {
  id: string;
  question: string;
  blocking: boolean;
  relatedRequirementIds: string[];
}

export interface Requirement {
  id: string;
  statement: string;
  source: 'brief' | 'discovery' | 'client' | 'inferred';
  priority: PlanPriority;
}

export interface ScopeModule {
  id: string;
  name: string;
  businessObjective: string;
  actors: string[];
  inScope: string[];
  outOfScope: string[];
  acceptanceCriteria: string[];
  requirementIds: string[];
  dependencyModuleIds: string[];
  assumptionIds: string[];
  openQuestionIds: string[];
  dataEntities: string[];
  integrations: string[];
  securityControls: string[];
  componentIds: string[];
  complexity: 'High' | 'Medium' | 'Low';
}

export interface ArchitectureComponent {
  id: string;
  name: string;
  responsibility: string;
  moduleIds: string[];
  runtime?: string | null;
  technology?: string | null;
  dataBoundary: string;
  interfaces: string[];
  errorHandling: string;
  observability?: string | null;
  security?: string | null;
  scaling?: string | null;
  dependencyComponentIds: string[];
  failureImpact?: string | null;
  decisions: string[];
  openDecisions: string[];
}

export interface ArchitectureEdge {
  fromComponentId: string;
  toComponentId: string;
  label?: string | null;
  kind?: 'sync' | 'async' | 'data' | 'event' | null;
}

export interface ArchitectureDocument {
  summary: string;
  components: ArchitectureComponent[];
  edges: ArchitectureEdge[];
}

export interface Workstream {
  id: string;
  name: string;
  description?: string | null;
}

export interface TeamCapacity {
  roleId: string;
  roleName: string;
  hoursPerWeek?: number | null;
}

export interface Deliverable {
  id: string;
  title: string;
  moduleId?: string | null;
}

export interface ClientAction {
  id: string;
  description: string;
  weekNumber: number;
  required: boolean;
}

export interface PlanTask {
  id: string;
  title: string;
  description: string;
  moduleId: string;
  workstreamId: string;
  ownerRoleId: string;
  estimateHours: number;
  startWeek: number;
  endWeek: number;
  dependencyTaskIds: string[];
  acceptanceCriteria: string[];
  evidenceRequired: string[];
  status: PlanTaskStatus;
  priority: PlanPriority;
}

export interface Checkpoint {
  id: string;
  title: string;
  type: CheckpointType;
  weekNumber: number;
  ownerRoleId: string;
  blocking: boolean;
  exitCriteria: string[];
  evidenceRequired: string[];
  linkedTaskIds: string[];
  status: CheckpointStatus;
}

export interface PlanWeek {
  id: string;
  weekNumber: number;
  label: string;
  objective: string;
  workstreamIds: string[];
  taskIds: string[];
  deliverableIds: string[];
  checkpointIds: string[];
  dependencyWeekIds: string[];
  clientActions: ClientAction[];
}

export interface PlanRiskLink {
  id: string;
  label: string;
  severity: number;
  category: string;
  affectedModuleIds: string[];
  affectedWeekNumbers: number[];
  mitigationTaskIds: string[];
  mitigationCheckpointIds: string[];
  status: 'open' | 'mitigated' | 'accepted';
}

export interface DiagnosticIssue {
  code: string;
  severity: DiagnosticSeverity;
  message: string;
  path?: string | null;
  suggestion?: string | null;
}

export interface CapacityCell {
  roleId: string;
  weekNumber: number;
  plannedHours: number;
  capacityHours?: number | null;
  utilizationPct?: number | null;
  state: 'ok' | 'warning' | 'over' | 'unknown';
}

export interface ScopeCoverage {
  requirementId: string;
  covered: boolean;
  moduleIds: string[];
  taskIds: string[];
  checkpointIds: string[];
}

export interface PlanDiagnostics {
  valid: boolean;
  computedAt?: string | null;
  issues: DiagnosticIssue[];
  capacity: CapacityCell[];
  scopeCoverage: ScopeCoverage[];
  coveredRequirementCount: number;
  totalRequirementCount: number;
  unresolvedQuestionCount: number;
  weekCount: number;
  taskCount: number;
  errorCount: number;
  warningCount: number;
}

export interface ExecutionPlan {
  schemaVersion: 2;
  projectStartDate?: string | null;
  degraded: boolean;
  degradedReason?: string | null;
  planningAssumptions: Assumption[];
  openQuestions: OpenQuestion[];
  requirements: Requirement[];
  scopeModules: ScopeModule[];
  architecture?: ArchitectureDocument | null;
  workstreams: Workstream[];
  teamCapacity: TeamCapacity[];
  deliverables: Deliverable[];
  tasks: PlanTask[];
  weeks: PlanWeek[];
  checkpoints: Checkpoint[];
  risks: PlanRiskLink[];
  diagnostics?: PlanDiagnostics | null;
}

// ---- Confidence Grid (AI-002) ----

// AIE-09: each grid factor is a deterministic base + bounded LLM modifier,
// with evidence. The headline confidenceIndex is a weighted blend of these.
export interface FactorScore {
  name: string;
  score: number; // final = clamp(deterministic_base + llm_modifier)
  deterministic_base: number;
  llm_modifier: number;
  evidence: string[];
}

export interface AuditorEvaluation {
  // null when the brief states no budget (factor excluded, not guessed).
  budget_alignment: FactorScore | null;
  deliverable_coverage: FactorScore;
  issues: string[];
  findings: string;
}

export interface FeasibilityEvaluation {
  technical_feasibility: FactorScore;
  timeline_realism: FactorScore;
  issues: string[];
  findings: string;
}

export interface ConfidenceGridResult {
  auditor: AuditorEvaluation;
  feasibility: FeasibilityEvaluation;
  confidenceIndex: number;
  optimized: boolean;
  finalProposal: Proposal;
}

// ---- Interview (AI-003) ----

export interface InterviewQuestion {
  question: string;
  rationale: string;
  expectedKeywords: string[];
  idealAnswerSummary: string;
}

export interface InterviewOutput {
  questions: InterviewQuestion[];
}

// ---- Contract Extensions (AI-004) ----

export interface ExtensionMilestone {
  title: string;
  description: string;
  estimatedDuration: string;
  complexity: 'Low' | 'Medium' | 'High';
  estimatedBudgetPct: number;
}

export interface ContractExtensionsOutput {
  extensionReasoning: string;
  suggestedMilestones: ExtensionMilestone[];
  extensionOfferDraft: string;
}

export interface ParseBriefResponse {
  proposal: Proposal;
  source: "llm" | "fallback";
  degradedReason?: string | null;
}

// ── Requirement Discovery Agent (Talent section) ──────────────────────────

export interface DiscoveryOption {
  key: string;
  label: string;
}

export interface DiscoveryQuestion {
  category: string;
  question: string;
  options: DiscoveryOption[];
  allow_custom: boolean;
  multi_select: boolean;
}

export interface DiscoveryProjectBrief {
  project_goal: string;
  target_users: string;
  platform: string;
  industry: string;
  problem_statement: string;
  core_features: string[];
  nice_to_have_features: string[];
  integrations: string[];
  authentication: string;
  admin_panel: boolean;
  ai_features: string[];
  timeline: string;
  budget: string;
  design_style: string;
  technical_preferences: string[];
  existing_assets: string[];
  success_criteria: string;
}

export interface DiscoveryTurn {
  status: 'questioning' | 'complete';
  confidence: number;
  next_question: DiscoveryQuestion | null;
  brief: DiscoveryProjectBrief | null;
  missing_information: string[];
}

export interface DiscoveryAnswer {
  question: string;
  answer: string;
}
