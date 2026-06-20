import { create } from 'zustand'
import type { AudienceId, WorkflowPhaseId } from '../data/landing'

interface LandingState {
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
}

export const useLandingStore = create<LandingState>((set) => ({
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
}))
