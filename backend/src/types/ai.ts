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
}

// ---- Confidence Grid (AI-002) ----

export interface AuditorEvaluation {
  budget_alignment_score: number;
  deliverable_coverage_score: number;
  issues: string[];
  findings: string;
}

export interface FeasibilityEvaluation {
  technical_feasibility_score: number;
  timeline_realism_score: number;
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
