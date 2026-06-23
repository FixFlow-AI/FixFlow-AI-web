import { create } from 'zustand'
import type { AudienceId, WorkflowPhaseId } from '../data/landing'

export type PageId = 'landing' | 'login' | 'signup' | 'dashboard'

export type DashboardTabId =
  | 'overview'
  | 'brief-intelligence'
  | 'evidence-confidence'
  | 'proposal-generator'
  | 'agreement-composer'
  | 'delivery-control'
  | 'milestone-funds'
  | 'outcome-evidence'
  | 'role-onboarding'

export interface MockMilestone {
  id: string
  title: string
  amount: number
  status: 'unfunded' | 'funded' | 'released'
  approved: boolean
}

export interface MockChangeRequest {
  id: string
  title: string
  amountChange: number
  timeChange: string
  status: 'pending' | 'accepted' | 'rejected'
}

interface LandingState {
  // Original Landing state
  audience: AudienceId
  heroStep: number
  intelligenceStep: number
  workflowPhase: WorkflowPhaseId
  demoRunning: boolean
  setAudience: (audience: AudienceId) => void
  setHeroStep: (step: number) => void
  setIntelligenceStep: (step: number) => void
  setWorkflowPhase: (phase: WorkflowPhaseId) => void
  setDemoRunning: (running: boolean) => void

  // Routing & Auth
  page: PageId
  dashboardTab: DashboardTabId
  isLoggedIn: boolean
  userEmail: string
  userRole: AudienceId
  setPage: (page: PageId) => void
  setDashboardTab: (tab: DashboardTabId) => void
  login: (email: string, role: AudienceId) => void
  logout: () => void

  // Onboarding
  onboardingGithubConnected: boolean
  onboardingWalletAddress: string
  onboardingTeam: string[]
  setGithubConnected: (connected: boolean) => void
  setWalletAddress: (address: string) => void
  addTeamMember: (email: string) => void

  // Brief Ingestion
  rawBriefText: string
  isBriefParsed: boolean
  setBriefText: (text: string) => void
  setBriefParsed: (parsed: boolean) => void

  // Proposal
  generatedProposal: string
  isProposalGenerated: boolean
  setGeneratedProposal: (proposal: string) => void
  setProposalGenerated: (generated: boolean) => void

  // Contract & Escrow FSM
  isAgreementSigned: { client: boolean; freelancer: boolean }
  escrowState: 'CREATED' | 'FUNDED' | 'RELEASED' | 'DISPUTED'
  milestones: MockMilestone[]
  changeRequests: MockChangeRequest[]
  signAgreement: (party: 'client' | 'freelancer') => void
  fundMilestone: (id: string) => void
  releaseMilestone: (id: string) => void
  addChangeRequest: (title: string, amountChange: number, timeChange: string) => void
  resolveChangeRequest: (id: string, status: 'accepted' | 'rejected') => void
  resetMockData: () => void
}

const initialMilestones: MockMilestone[] = [
  { id: 'm1', title: 'Phase 1: Brief Ingestion & Architecture Planning', amount: 8000, status: 'unfunded', approved: false },
  { id: 'm2', title: 'Phase 2: Core State Machine & Escrow Gateway Integration', amount: 10500, status: 'unfunded', approved: false },
  { id: 'm3', title: 'Phase 3: Polygon SBT Reputation DID Minting Pipeline', amount: 6000, status: 'unfunded', approved: false },
]

export const useLandingStore = create<LandingState>((set) => ({
  // Original state defaults
  audience: 'client',
  heroStep: 0,
  intelligenceStep: 0,
  workflowPhase: 'agreement',
  demoRunning: false,
  setAudience: (audience) => set({ audience }),
  setHeroStep: (heroStep) => set({ heroStep }),
  setIntelligenceStep: (intelligenceStep) => set({ intelligenceStep }),
  setWorkflowPhase: (workflowPhase) => set({ workflowPhase }),
  setDemoRunning: (demoRunning) => set({ demoRunning }),

  // Routing & Auth
  page: 'landing',
  dashboardTab: 'overview',
  isLoggedIn: false,
  userEmail: '',
  userRole: 'client',
  setPage: (page) => set({ page }),
  setDashboardTab: (dashboardTab) => set({ dashboardTab }),
  login: (email, role) => set({ isLoggedIn: true, userEmail: email, userRole: role, page: 'dashboard' }),
  logout: () => set({ isLoggedIn: false, userEmail: '', page: 'landing', dashboardTab: 'overview' }),

  // Onboarding
  onboardingGithubConnected: false,
  onboardingWalletAddress: '',
  onboardingTeam: ['lead-dev@northstar.io', 'product@northstar.io'],
  setGithubConnected: (onboardingGithubConnected) => set({ onboardingGithubConnected }),
  setWalletAddress: (onboardingWalletAddress) => set({ onboardingWalletAddress }),
  addTeamMember: (email) => set((state) => ({ onboardingTeam: [...state.onboardingTeam, email] })),

  // Brief Ingestion
  rawBriefText: 'Migrate our payment infrastructure to Razorpay and deploy a secondary Polygon USDC payment pathway. Keep the transition seamless without subscription downtime.',
  isBriefParsed: false,
  setBriefText: (rawBriefText) => set({ rawBriefText }),
  setBriefParsed: (isBriefParsed) => set({ isBriefParsed }),

  // Proposal
  generatedProposal: '',
  isProposalGenerated: false,
  setGeneratedProposal: (generatedProposal) => set({ generatedProposal }),
  setProposalGenerated: (isProposalGenerated) => set({ isProposalGenerated }),

  // Contract & Escrow
  isAgreementSigned: { client: false, freelancer: false },
  escrowState: 'CREATED',
  milestones: initialMilestones,
  changeRequests: [
    { id: 'c1', title: 'Add idempotent event auditing log endpoints', amountChange: 2000, timeChange: '+4 days', status: 'pending' }
  ],
  signAgreement: (party) => set((state) => {
    const updatedSigned = { ...state.isAgreementSigned, [party]: true }
    return { isAgreementSigned: updatedSigned }
  }),
  fundMilestone: (id) => set((state) => {
    const updatedMilestones = state.milestones.map((m) =>
      m.id === id ? { ...m, status: 'funded' as const } : m
    )
    const allFundedOrReleased = updatedMilestones.every((m) => m.status === 'funded' || m.status === 'released')
    return {
      milestones: updatedMilestones,
      escrowState: allFundedOrReleased ? 'FUNDED' : state.escrowState
    }
  }),
  releaseMilestone: (id) => set((state) => {
    const updatedMilestones = state.milestones.map((m) =>
      m.id === id ? { ...m, status: 'released' as const, approved: true } : m
    )
    const allReleased = updatedMilestones.every((m) => m.status === 'released')
    return {
      milestones: updatedMilestones,
      escrowState: allReleased ? 'RELEASED' : state.escrowState
    }
  }),
  addChangeRequest: (title, amountChange, timeChange) => set((state) => ({
    changeRequests: [
      ...state.changeRequests,
      { id: `c_${Date.now()}`, title, amountChange, timeChange, status: 'pending' }
    ]
  })),
  resolveChangeRequest: (id, status) => set((state) => {
    const updatedReqs = state.changeRequests.map((r) =>
      r.id === id ? { ...r, status } : r
    )
    const matched = state.changeRequests.find((r) => r.id === id)
    if (status === 'accepted' && matched) {
      // Create new milestone or expand the active milestone
      const newMilestone: MockMilestone = {
        id: `m_${Date.now()}`,
        title: `Scope Extension: ${matched.title}`,
        amount: matched.amountChange,
        status: 'unfunded',
        approved: false
      }
      return {
        changeRequests: updatedReqs,
        milestones: [...state.milestones, newMilestone],
        escrowState: 'CREATED' // Requires funding again
      }
    }
    return { changeRequests: updatedReqs }
  }),
  resetMockData: () => set({
    isAgreementSigned: { client: false, freelancer: false },
    escrowState: 'CREATED',
    milestones: initialMilestones,
    changeRequests: [
      { id: 'c1', title: 'Add idempotent event auditing log endpoints', amountChange: 2000, timeChange: '+4 days', status: 'pending' }
    ],
    onboardingGithubConnected: false,
    onboardingWalletAddress: '',
    onboardingTeam: ['lead-dev@northstar.io', 'product@northstar.io'],
    isBriefParsed: false,
    isProposalGenerated: false,
    generatedProposal: ''
  })
}))

