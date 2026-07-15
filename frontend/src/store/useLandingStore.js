import { create } from "zustand";
import { api, ApiError } from "../lib/api";

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
  page: (() => {
    if (typeof window === "undefined") return "landing";
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    if (params.get("code") && params.get("state")) {
      return "landing"; // Handled by AuthLoader in App.jsx
    }
    if (hash === "#/login") return "login";
    if (hash === "#/signup") return "signup";
    if (hash.startsWith("#/dashboard")) {
      const token = localStorage.getItem("ff_access_token");
      const userRaw = localStorage.getItem("ff_user");
      if (token && userRaw) return "dashboard";
      return "login";
    }
    return "landing";
  })(),
  dashboardTab: (() => {
    if (typeof window === "undefined") return "overview";
    const hash = window.location.hash;
    if (hash.startsWith("#/dashboard")) {
      const parts = hash.split("/");
      return parts[2] || "overview";
    }
    return "overview";
  })(),
  isLoggedIn: (() => {
    if (typeof window === "undefined") return false;
    const token = localStorage.getItem("ff_access_token");
    const userRaw = localStorage.getItem("ff_user");
    return Boolean(token && userRaw);
  })(),
  userEmail: (() => {
    if (typeof window === "undefined") return "";
    try {
      const user = JSON.parse(localStorage.getItem("ff_user") || "null");
      return user?.email || "";
    } catch {
      return "";
    }
  })(),
  userRole: (() => {
    if (typeof window === "undefined") return "client";
    try {
      const user = JSON.parse(localStorage.getItem("ff_user") || "null");
      return user?.role || "client";
    } catch {
      return "client";
    }
  })(),
  user: (() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(localStorage.getItem("ff_user") || "null");
    } catch {
      return null;
    }
  })(),
  isAuthenticating: (() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return Boolean(params.get("code") && params.get("state"));
  })(),
  setIsAuthenticating: (isAuthenticating) => set({ isAuthenticating }),
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
  removeTeamMember: (email) =>
    set((state) => ({
      onboardingTeam: state.onboardingTeam.filter((m) => m !== email),
    })),

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

  // AI-006: Freelancer matching
  matchResults: null,
  matchError: null,
  setMatchResults: (matchResults) => set({ matchResults }),
  setMatchError: (matchError) => set({ matchError }),

  // ── Navigation-resilient loading flags ──────────────────────────────
  // These live in the store (not component-local useState) so that an
  // in-flight AI call survives dashboard tab switches. Components read
  // these flags to show spinners and call the `run*` thunks to trigger.
  briefParsing: false,
  confidenceEvaluating: false,
  interviewGenerating: false,
  extensionsSuggesting: false,
  matchingLoading: false,

  // ── Store-level async action thunks ─────────────────────────────────
  // The promise is owned by the store, not a component. Results are
  // written to the store regardless of whether the triggering component
  // is still mounted.

  runBriefParse: async (text) => {
    set({ briefParsing: true, briefError: "" });
    useLandingStore.getState().setBriefText(text);
    try {
      const { proposal, proposalId } = await api.parseBrief(text);
      set({
        parsedProposal: proposal,
        parsedProposalId: proposalId,
        briefSource: "api",
        isBriefParsed: true,
      });
    } catch (err) {
      const reason =
        err instanceof ApiError && err.status === 503
          ? "AI is not configured on the server (missing GEMINI_API_KEY). Showing a sample result."
          : "Couldn't reach the live parser. Showing a sample result.";
      set({
        briefError: reason,
        parsedProposal: null,
        briefSource: "mock",
        isBriefParsed: true,
      });
    } finally {
      set({ briefParsing: false });
    }
  },

  runConfidenceEval: async () => {
    const state = useLandingStore.getState();
    if (!state.parsedProposal) return;
    set({ confidenceEvaluating: true });
    try {
      const result = await api.evaluateProposal(
        state.rawBriefText,
        state.parsedProposal,
        state.parsedProposalId,
      );
      set({ confidenceResult: result, confidenceSource: "api" });
    } catch (err) {
      const reason =
        err instanceof ApiError && err.status === 503
          ? "AI not configured on the server (missing GEMINI_API_KEY). Showing sample confidence."
          : "Couldn't reach the evaluation service. Showing sample confidence.";
      set({ confidenceResult: null, confidenceSource: "mock", confidenceNotice: reason });
    } finally {
      set({ confidenceEvaluating: false });
    }
  },

  runInterviewGenerate: async () => {
    const state = useLandingStore.getState();
    set({ interviewGenerating: true });
    try {
      const missingSkills = state.parsedProposal?.risks
        ?.slice(0, 3)
        .map((r) => r.label) ?? ["Target runtime confirmation"];
      const githubScan =
        "Languages: TypeScript, Node.js. Repos: billing-migration, webhook-utils.";
      const output = await api.interviewQuestions(
        state.rawBriefText || "Billing migration project",
        githubScan,
        missingSkills,
      );
      set({ interviewQuestions: output, interviewSource: "api" });
    } catch (_err) {
      set({
        interviewQuestions: {
          questions: [
            {
              question:
                "How would you keep webhook processing idempotent during a live billing migration?",
              rationale: "Tests the core reliability requirement of this project.",
              expectedKeywords: ["idempotency key", "dedupe", "retry", "ledger"],
              idealAnswerSummary:
                "Uses a persisted idempotency key and a dedup table to make retries safe.",
            },
            {
              question:
                "Describe your rollback strategy if the cutover fails mid-migration.",
              rationale: "Rollback ownership is the top open risk on this brief.",
              expectedKeywords: ["rollback", "snapshot", "feature flag", "dry run"],
              idealAnswerSummary:
                "Has a tested, reversible plan with clear ownership and a dry run.",
            },
          ],
        },
        interviewSource: "mock",
      });
    } finally {
      set({ interviewGenerating: false });
    }
  },

  runExtensionsSuggest: async () => {
    set({ extensionsSuggesting: true });
    try {
      const completedDeliverables = ["Webhook migration"];
      const chatSummary =
        "Client mentioned wanting tax-region reconciliation and analytics next. Migration delivered on time with strong reliability.";
      const output = await api.contractExtensions(
        completedDeliverables,
        chatSummary,
      );
      set({ contractExtensions: output, extensionsSource: "api" });
    } catch (err) {
      const reason =
        err instanceof ApiError && err.status === 503
          ? "AI not configured (missing GEMINI_API_KEY). Showing sample suggestions."
          : "Couldn't reach the extensions service. Showing sample suggestions.";
      set({
        contractExtensions: {
          extensionReasoning:
            "The migration is delivered and stable. A support window plus the discussed analytics phase are the natural next steps.",
          suggestedMilestones: [
            {
              title: "Post-delivery support & monitoring",
              description: "2-week support window to monitor the cutover and resolve production issues.",
              estimatedDuration: "14 days",
              complexity: "Low",
              estimatedBudgetPct: 15,
            },
            {
              title: "Tax-region reconciliation analytics",
              description: "Dashboard for reconciliation variance by tax region, as discussed.",
              estimatedDuration: "10 days",
              complexity: "Medium",
              estimatedBudgetPct: 25,
            },
          ],
        },
        extensionsSource: "mock",
        extensionsNotice: reason,
      });
    } finally {
      set({ extensionsSuggesting: false });
    }
  },

  runMatchFreelancers: async () => {
    const state = useLandingStore.getState();
    if (!state.parsedProposal) {
      set({ matchError: "Please parse a brief first in the Brief Ingestion tab." });
      return;
    }
    set({ matchingLoading: true, matchError: null });
    try {
      const requiredSkills =
        state.parsedProposal?.features?.map((f) => f.area).filter(Boolean) ?? [];
      const domains =
        state.parsedProposal?.features?.map((f) => f.title).filter(Boolean) ?? [];
      const data = await api.matchFreelancers(requiredSkills, 10000, domains, 5);
      set({ matchResults: data });
    } catch (err) {
      const reason =
        err instanceof ApiError
          ? err.message
          : "Couldn't reach the matching service.";
      set({ matchError: reason });
    } finally {
      set({ matchingLoading: false });
    }
  },

  // Notice text for confidence and extensions (store-level so it survives nav)
  confidenceNotice: "",
  setConfidenceNotice: (confidenceNotice) => set({ confidenceNotice }),
  extensionsNotice: "",
  setExtensionsNotice: (extensionsNotice) => set({ extensionsNotice }),

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
  hydrateLatestProposal: (storedProposal) =>
    set((state) => {
      if (!storedProposal) return {};

      // Auto-reconstruct generatedProposal if we have parsedProposal
      let generatedMarkdown = "";
      const p = storedProposal.proposal;
      if (p) {
        const featureLines = (p.features || [])
          .map((f) => `- **${f.title}** (${f.area || ""}, ${f.complexity || ""} complexity): ${f.description || ""}`)
          .join("\n");
        const milestoneLines = (p.timeline || [])
          .map((phase, idx) => `- **Phase ${idx + 1}: ${phase.phase}** (${phase.duration}) — ${(phase.tasks || []).join(", ")}`)
          .join("\n");
        const riskLines = (p.risks || [])
          .map((r) => `- **${r.label || r.description}** (severity ${r.severity}): ${r.mitigation || ""}`)
          .join("\n");

        generatedMarkdown = [
          "# PROJECT PROPOSAL\n\n",
          `## 1. Project Summary\n${p.project_summary || ""}\n\n`,
          `## 2. Scope & Features\n${featureLines}\n\n`,
          `## 3. Timeline & Milestones\n${milestoneLines}\n\n`,
          `## 4. Risks & Mitigations\n${riskLines}`,
        ].join("");
      }

      return {
        rawBriefText: storedProposal.briefText || "",
        isBriefParsed: Boolean(storedProposal.proposal),
        parsedProposal: storedProposal.proposal || null,
        parsedProposalId: storedProposal.proposalId || null,
        briefSource: storedProposal.proposal ? "api" : null,
        isProposalGenerated: Boolean(storedProposal.proposal),
        generatedProposal: generatedMarkdown,
        confidenceResult: storedProposal.evaluation || null,
        confidenceSource: storedProposal.evaluation ? "api" : null,
      };
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
      matchResults: null,
      matchError: null,
      confidenceNotice: "",
      extensionsNotice: "",
    }),
}));
