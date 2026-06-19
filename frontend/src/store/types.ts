export interface UserState {
  email: string;
  role: 'USER' | 'MANAGER' | 'ADMIN' | 'SUPER_ADMIN';
  mfaEnabled: boolean;
  selectedPlan: 'FREE' | 'SOLO' | 'PRO' | 'AGENCY';
}

export interface LeadItem {
  id: string;
  score: number;
  source: string;
  sourceUrl?: string;
  projectDescription: string;
  budget: { amount: number; rate: 'fixed' | 'hourly'; currency: string };
  status: 'NEW' | 'QUALIFIED' | 'CONTACTED' | 'REPLIED' | 'WON' | 'LOST';
  matchDetails?: { skillsMatched: string[]; skillsMissing: string[]; githubEvidence: string[] };
  company?: { name: string; size: number; stack: string[]; stabilityScore: number; paymentSpeed: number };
  interviewQuestions?: Array<{ question: string; rationale: string; expectedKeywords: string[]; idealAnswerSummary: string }>;
}

export interface ProposalItem {
  id: string;
  title: string;
  s3Key: string;
  projectSummary: string;
  status: 'GENERATING' | 'READY' | 'FAILED';
  dealStatus: 'PENDING' | 'NEGOTIATING' | 'WON' | 'LOST';
  versionCount: number;
  briefScore: { scope: number; technical: number; timeline: number };
  createdAt: string;
  comments: Array<{ id: string; sender: string; text: string; createdAt: string }>;
}

export interface WorkspaceItem {
  id: string;
  name: string;
  plan: string;
  members: Array<{ name: string; role: string }>;
  suggestedExtensions?: {
    extensionReasoning: string;
    suggestedMilestones: Array<{ title: string; description: string; estimatedDuration: string; complexity: 'Low' | 'Medium' | 'High'; estimatedBudgetPct: number }>;
    extensionOfferDraft: string;
  };
}

export interface EscrowMilestone {
  id: string;
  title: string;
  percentage: number;
  amount: number;
  approved: boolean;
  state: 'Draft' | 'Pending_Deposit' | 'Active' | 'In_Review' | 'Revision_Requested' | 'Approved' | 'Funds_Released' | 'Dispute';
  version: number;
  lastAuditHash: string;
}

export interface EscrowItem {
  id: string;
  leadId: string;
  clientDid: string;
  freelancerDid: string;
  buyerAddress: string;
  sellerAddress: string;
  totalAmount: number;
  currency: string;
  milestones: EscrowMilestone[];
  razorpayPaymentId: string;
  chain: string;
  auditTrail: Array<{
    index: number;
    timestamp: string;
    milestoneId: string;
    fromState: string;
    toState: string;
    triggerUserId: string;
    triggerUserRole: string;
    metadata: string;
    previousHash: string;
    hash: string;
  }>;
}
