import { create } from "zustand";

const initialMilestones = [];

export const useLandingStore = create((set) => ({
  // Original state defaults
  audience: "client",
  heroStep: 0,
  intelligenceStep: 0,
  workflowPhase: "agreement",
  demoRunning: false,
  setAudience: (audience) => set({ audience }),
  setHeroStep: (heroStep) => set({ heroStep }),
  setIntelligenceStep: (intelligenceStep) => set({ intelligenceStep }),
  setWorkflowPhase: (workflowPhase) => set({ workflowPhase }),
  setDemoRunning: (demoRunning) => set({ demoRunning }),

  // Routing & Auth
  page: "landing",
  dashboardTab: "overview",
  isLoggedIn: false,
  userEmail: "",
  userRole: "client",
  user: null,
  setPage: (page) => set({ page }),
  setDashboardTab: (dashboardTab) => set({ dashboardTab }),
  // Called after a successful Google sign-in (real user object from the backend).
  login: (user) =>
    set({
      isLoggedIn: true,
      user,
      userEmail: user?.email || "",
      userRole: user?.role || "client",
      page: "dashboard",
    }),
  // Rehydrate auth state from a persisted session on app load.
  hydrateAuth: (user) =>
    set({
      isLoggedIn: Boolean(user),
      user: user || null,
      userEmail: user?.email || "",
      userRole: user?.role || "client",
    }),
  logout: () =>
    set({
      isLoggedIn: false,
      user: null,
      userEmail: "",
      page: "landing",
      dashboardTab: "overview",
    }),

  // Onboarding
  onboardingGithubConnected: false,
  onboardingWalletAddress: "",
  onboardingTeam: [],
  setGithubConnected: (onboardingGithubConnected) =>
    set({ onboardingGithubConnected }),
  setWalletAddress: (onboardingWalletAddress) =>
    set({ onboardingWalletAddress }),
  addTeamMember: (email) =>
    set((state) => ({ onboardingTeam: [...state.onboardingTeam, email] })),

  // Brief Ingestion
  rawBriefText: "",
  isBriefParsed: false,
  setBriefText: (rawBriefText) => set({ rawBriefText }),
  setBriefParsed: (isBriefParsed) => set({ isBriefParsed }),

  // Structured proposal returned by the backend brief parser (null until parsed).
  // `briefSource` records whether the data came from the live API or the local mock fallback.
  parsedProposal: null,
  parsedProposalId: null,
  briefSource: null, // "api" | "mock" | null
  briefError: "",
  setParsedProposal: (parsedProposal) => set({ parsedProposal }),
  setParsedProposalId: (parsedProposalId) => set({ parsedProposalId }),
  setBriefSource: (briefSource) => set({ briefSource }),
  setBriefError: (briefError) => set({ briefError }),

  // Proposal
  generatedProposal: "",
  isProposalGenerated: false,
  setGeneratedProposal: (generatedProposal) => set({ generatedProposal }),
  setProposalGenerated: (isProposalGenerated) => set({ isProposalGenerated }),

  // AI-002: Confidence Grid evaluation result (null until evaluated)
  confidenceResult: null,
  confidenceSource: null, // "api" | "mock" | null
  setConfidenceResult: (confidenceResult) => set({ confidenceResult }),
  setConfidenceSource: (confidenceSource) => set({ confidenceSource }),

  // AI-003: Generated interview questions
  interviewQuestions: null,
  interviewSource: null,
  setInterviewQuestions: (interviewQuestions) => set({ interviewQuestions }),
  setInterviewSource: (interviewSource) => set({ interviewSource }),

  // AI-004: Contract extension suggestions
  contractExtensions: null,
  extensionsSource: null,
  setContractExtensions: (contractExtensions) => set({ contractExtensions }),
  setExtensionsSource: (extensionsSource) => set({ extensionsSource }),

  // Contract & Escrow
  isAgreementSigned: { client: false, freelancer: false },
  escrowState: "CREATED",
  milestones: initialMilestones,
  changeRequests: [],
  signAgreement: (party) =>
    set((state) => {
      const updatedSigned = { ...state.isAgreementSigned, [party]: true };
      return { isAgreementSigned: updatedSigned };
    }),
  fundMilestone: (id) =>
    set((state) => {
      const updatedMilestones = state.milestones.map((m) =>
        m.id === id ? { ...m, status: "funded" } : m,
      );
      const allFundedOrReleased = updatedMilestones.every(
        (m) => m.status === "funded" || m.status === "released",
      );
      return {
        milestones: updatedMilestones,
        escrowState: allFundedOrReleased ? "FUNDED" : state.escrowState,
      };
    }),
  releaseMilestone: (id) =>
    set((state) => {
      const updatedMilestones = state.milestones.map((m) =>
        m.id === id ? { ...m, status: "released", approved: true } : m,
      );
      const allReleased = updatedMilestones.every(
        (m) => m.status === "released",
      );
      return {
        milestones: updatedMilestones,
        escrowState: allReleased ? "RELEASED" : state.escrowState,
      };
    }),
  addChangeRequest: (title, amountChange, timeChange) =>
    set((state) => ({
      changeRequests: [
        ...state.changeRequests,
        {
          id: `c_${Date.now()}`,
          title,
          amountChange,
          timeChange,
          status: "pending",
        },
      ],
    })),
  resolveChangeRequest: (id, status) =>
    set((state) => {
      const updatedReqs = state.changeRequests.map((r) =>
        r.id === id ? { ...r, status } : r,
      );
      const matched = state.changeRequests.find((r) => r.id === id);
      if (status === "accepted" && matched) {
        // Create new milestone or expand the active milestone
        const newMilestone = {
          id: `m_${Date.now()}`,
          title: `Scope Extension: ${matched.title}`,
          amount: matched.amountChange,
          status: "unfunded",
          approved: false,
        };
        return {
          changeRequests: updatedReqs,
          milestones: [...state.milestones, newMilestone],
          escrowState: "CREATED", // Requires funding again
        };
      }
      return { changeRequests: updatedReqs };
    }),
  resetMockData: () =>
    set({
      isAgreementSigned: { client: false, freelancer: false },
      escrowState: "CREATED",
      milestones: [],
      changeRequests: [],
      onboardingGithubConnected: false,
      onboardingWalletAddress: "",
      onboardingTeam: [],
      isBriefParsed: false,
      isProposalGenerated: false,
      generatedProposal: "",
      parsedProposal: null,
      briefSource: null,
      briefError: "",
      confidenceResult: null,
      confidenceSource: null,
      interviewQuestions: null,
      interviewSource: null,
      contractExtensions: null,
      extensionsSource: null,
    }),
}));
