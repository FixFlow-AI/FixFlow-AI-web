# FixFlow AI - Frontend Implementation Guide

This guide provides technical specifications, code blueprints, and state schemas for implementing the remaining frontend components of the FixFlow AI platform.

---

## 🧭 1. Routing & Sidebar Navigation Extensions

The frontend uses hash-based routing in [App.jsx](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/frontend/src/App.jsx) and [Dashboard.jsx](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/frontend/src/sections/Dashboard.jsx). To integrate the new capabilities, we must extend both the routes and the sidebar menu items.

### A. Route Registration in `App.jsx`
Update the `useEffect` hash handler in `App.jsx` to recognize the claim routing and new dashboard paths:

```javascript
// Add these routes inside the App hash change handler
} else if (hash.startsWith("#/claim/")) {
  setPage("claim");
  const proposalId = hash.split("/")[2];
  setClaimProposalId(proposalId);
} else if (hash.startsWith("#/dashboard")) {
  setPage("dashboard");
  const parts = hash.split("/");
  const tab = parts[2];
  if (tab) {
    setDashboardTab(tab);
  } else {
    setDashboardTab("overview");
  }
}
```

### B. Sidebar Updates in `Dashboard.jsx`
Add the new menu items into the sidebar navigation layout configuration:

```javascript
import { ShieldCheck, Search, HelpCircle, Settings } from "lucide-react";

const menuItems = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "opportunities", label: "Discovery Board", icon: Search }, // [NEW]
  { id: "brief-intelligence", label: "Brief Ingestion", icon: FileText },
  { id: "proposal-generator", label: "Proposal Builder", icon: Cpu },
  { id: "vetting-center", label: "Interview Vetting", icon: HelpCircle }, // [NEW]
  { id: "agreement-composer", label: "Agreement Composer", icon: FileSignature },
  { id: "delivery-control", label: "Delivery Control", icon: KanbanSquare },
  { id: "milestone-funds", label: "Milestone Funds", icon: Coins },
  { id: "outcome-evidence", label: "Outcome Reputation", icon: Award },
  { id: "security-settings", label: "MFA & Wallets", icon: ShieldCheck }, // [NEW]
];
```

---

## 🗄️ 2. Zustand State Store Extensions (`useLandingStore.js`)

We need to add state properties, loaders, and API actions to [useLandingStore.js](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/frontend/src/store/useLandingStore.js) to support the new features.

```javascript
// State extensions for useLandingStore.js
export const useLandingStore = create((set) => ({
  // ... existing states ...

  // Wallet Connection State
  walletConnected: false,
  walletAddress: "",
  walletNetwork: "",
  
  // Opportunities Board
  opportunities: [],
  loadingOpportunities: false,
  opportunitiesFilters: { skills: [], budgetMin: 0, source: "" },

  // Project Claim State
  claimProposalId: "",
  claimEmail: "",
  claimOtp: "",
  claimStatus: "idle", // 'idle' | 'otp_sent' | 'claiming' | 'success' | 'error'

  // Vetting Center State
  missingSkillsGaps: [],
  vettingQuestions: [],
  submittingAnswers: false,
  vettingResult: null,

  // MFA Payout Security
  mfaEnabled: false,
  mfaSecret: "",
  mfaQrCode: "",

  // Actions
  connectWallet: async (address, network) => {
    set({ walletConnected: true, walletAddress: address, walletNetwork: network });
  },
  
  fetchOpportunities: async (skills) => {
    set({ loadingOpportunities: true });
    try {
      const response = await fetch(`/api/opportunities?skills=${skills.join(",")}`);
      const data = await response.json();
      set({ opportunities: data, loadingOpportunities: false });
    } catch (err) {
      set({ loadingOpportunities: false });
    }
  },

  sendClaimOtp: async (email, proposalId) => {
    set({ claimStatus: "claiming" });
    const res = await fetch("/api/leads/claim/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, proposalId })
    });
    if (res.ok) set({ claimStatus: "otp_sent", claimEmail: email });
    else set({ claimStatus: "error" });
  },

  submitClaim: async (otp, proposalId) => {
    set({ claimStatus: "claiming" });
    const res = await fetch("/api/leads/claim/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otp, proposalId })
    });
    if (res.ok) set({ claimStatus: "success" });
    else set({ claimStatus: "error" });
  },

  generateVettingQuestions: async (projectId, missingSkills) => {
    set({ submittingAnswers: true });
    const res = await fetch(`/api/vetting/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, missingSkills })
    });
    const data = await res.json();
    set({ vettingQuestions: data.questions, submittingAnswers: false });
  },

  verifyMfaSetup: async (token, secret) => {
    const res = await fetch("/api/auth/mfa/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, secret })
    });
    if (res.ok) {
      set({ mfaEnabled: true, mfaSecret: secret });
      return true;
    }
    return false;
  }
}));
```

---

## 🎨 3. Component Blueprints

### A. Opportunity Board (`OpportunityBoard.jsx`)
This component displays open freelance contracts retrieved from external sources.

```jsx
import { useState, useEffect } from "react";
import { useLandingStore } from "../../store/useLandingStore";
import { ArrowRight, HelpCircle, Shield, Award } from "lucide-react";

export function OpportunityBoard() {
  const { opportunities, fetchOpportunities, loadingOpportunities, setDashboardTab, setGeneratedProposal, setProposalGenerated } = useLandingStore();
  const [skillsFilter, setSkillsFilter] = useState("React");

  useEffect(() => {
    fetchOpportunities([skillsFilter]);
  }, [skillsFilter, fetchOpportunities]);

  const handleDraftProposal = (opportunity) => {
    // Populate the proposal generator state with opportunity details
    setGeneratedProposal(opportunity.projectDescription);
    setProposalGenerated(true);
    setDashboardTab("proposal-generator");
    window.location.hash = "#/dashboard/proposal-generator";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Discovery Board</h1>
          <p className="text-slate-500 text-xs">Real-time open opportunities scraped compliantly and matched to your skills.</p>
        </div>
        <select 
          value={skillsFilter} 
          onChange={(e) => setSkillsFilter(e.target.value)}
          className="border border-[#D9E0E8] rounded px-3 py-1 text-xs font-semibold bg-white"
        >
          <option value="React">React Developer</option>
          <option value="Node.js">Node.js Engineer</option>
          <option value="Smart Contracts">Solidity Engineer</option>
        </select>
      </div>

      {loadingOpportunities ? (
        <div className="p-12 text-center text-xs text-slate-500">Loading open opportunities...</div>
      ) : (
        <div className="space-y-4">
          {opportunities.map((opp) => (
            <div key={opp.id} className="bg-white border border-[#D9E0E8] p-5 rounded-lg flex flex-col md:flex-row justify-between gap-6 hover:border-slate-400 transition-colors">
              <div className="space-y-3 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold uppercase tracking-wider">{opp.source}</span>
                  <span className="text-xs text-slate-400 font-medium">{new Date(opp.createdAt).toLocaleDateString()}</span>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{opp.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{opp.projectDescription}</p>
                
                {/* Enriched Company Context Card (Apollo.io) */}
                {opp.company && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 border-t border-slate-100 pt-2 mt-2">
                    <span className="font-semibold text-slate-700">{opp.company.name}</span>
                    <span>Employees: {opp.company.size || "Unknown"}</span>
                    <span>Tech: {opp.company.techStack?.slice(0, 3).join(", ")}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between items-end shrink-0 gap-4">
                {/* Composite Score indicator */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded relative group cursor-help">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Opportunity Score:</span>
                  <span className="text-xs font-extrabold text-[#2563EB]">{opp.score}</span>
                  
                  {/* Tooltip Breakdown */}
                  <div className="hidden group-hover:block absolute right-0 top-8 bg-slate-900 text-white text-[10px] p-3 rounded shadow-lg z-50 w-48 space-y-1 font-mono">
                    <div className="flex justify-between"><span>Skill Match:</span><span>{opp.matchDetails?.skillsScore || 0}%</span></div>
                    <div className="flex justify-between"><span>Budget Fit:</span><span>{opp.matchDetails?.budgetScore || 0}%</span></div>
                    <div className="flex justify-between"><span>Recency:</span><span>{opp.matchDetails?.recencyScore || 0}%</span></div>
                    <div className="flex justify-between border-t border-slate-700 pt-1 mt-1 font-bold text-blue-400"><span>Confidence:</span><span>{opp.score}/100</span></div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <a href={opp.sourceUrl} target="_blank" rel="noreferrer" className="px-3 py-1.5 border border-[#D9E0E8] hover:bg-slate-50 text-slate-700 font-bold text-xs rounded transition-colors">Apply on Source</a>
                  <button onClick={() => handleDraftProposal(opp)} className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#173EA5] text-white font-bold text-xs rounded transition-all flex items-center gap-1">Draft Proposal <ArrowRight size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

### B. Client Claim Portal (`ClientClaimPortal.jsx`)
A dedicated layout rendered under `#/claim/:proposalId` for clients claiming an ingestion lead.

```jsx
import { useState } from "react";
import { useLandingStore } from "../../store/useLandingStore";
import { ShieldCheck, Mail, ArrowRight, AlertTriangle } from "lucide-react";

export function ClientClaimPortal() {
  const { claimProposalId, claimStatus, sendClaimOtp, submitClaim } = useLandingStore();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [consent, setConsent] = useState(false);

  const handleSendOtp = (e) => {
    e.preventDefault();
    if (email && consent) sendClaimOtp(email, claimProposalId);
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (otp) submitClaim(otp, claimProposalId);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-[#D9E0E8] p-8 rounded-lg shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <ShieldCheck size={36} className="text-[#2563EB] mx-auto" />
          <h2 className="text-xl font-bold text-slate-900">Claim Your Project Workspace</h2>
          <p className="text-xs text-slate-500">Verify your ownership of this imported project proposal to access your secure execution room.</p>
        </div>

        {claimStatus === "idle" || claimStatus === "error" ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full border border-[#D9E0E8] rounded px-3 py-2 pl-9 text-xs focus:outline-none focus:border-[#2563EB] bg-white text-slate-900"
                  required
                />
                <Mail size={14} className="absolute left-3 top-3 text-slate-400" />
              </div>
            </div>

            <div className="flex items-start gap-2 pt-2">
              <input 
                type="checkbox" 
                id="consent" 
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 border-[#D9E0E8] rounded"
                required
              />
              <label htmlFor="consent" className="text-[11px] text-slate-500 leading-relaxed">
                I verify that I own or control the project brief associated with this proposal, and I agree to use the secure FixFlow AI Escrow workspace for deliverables release.
              </label>
            </div>

            {claimStatus === "error" && (
              <div className="text-[10px] text-red-600 font-bold bg-red-50 border border-red-100 p-2.5 rounded flex items-center gap-1.5">
                <AlertTriangle size={12} /> Claim failed. Verify that your email matches the opportunity record domain.
              </div>
            )}

            <button 
              type="submit" 
              disabled={!consent}
              className="w-full py-2 bg-slate-900 hover:bg-[#2563EB] text-white text-xs font-bold rounded transition-colors disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
            >
              Send Verification OTP <ArrowRight size={12} />
            </button>
          </form>
        ) : claimStatus === "otp_sent" ? (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Enter OTP Code</label>
              <input 
                type="text" 
                value={otp} 
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit code"
                className="w-full border border-[#D9E0E8] rounded px-3 py-2 text-center font-mono font-bold tracking-widest focus:outline-none focus:border-[#2563EB] bg-white text-slate-900"
                maxLength={6}
                required
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-2 bg-[#2563EB] hover:bg-[#173EA5] text-white text-xs font-bold rounded transition-colors cursor-pointer"
            >
              Confirm and Open Workspace
            </button>
          </form>
        ) : (
          <div className="text-center py-6 space-y-3">
            <ShieldCheck size={44} className="text-emerald-500 mx-auto animate-pulse" />
            <h4 className="font-bold text-slate-800 text-sm">Workspace Activated!</h4>
            <p className="text-xs text-slate-500">Your credentials have been bound. You are being redirected to the workspace panel...</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### C. Secure MFA Release Modal (`MFAModal.jsx`)
Triggered before client payout release endpoints in [MilestoneFunds.jsx](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/frontend/src/sections/dashboard/MilestoneFunds.jsx).

```jsx
import { useState } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";

export function MFAModal({ isOpen, onClose, onConfirm, milestone }) {
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");

    try {
      const success = await onConfirm(token);
      if (success) {
        onClose();
      } else {
        setErrorMsg("Invalid Authenticator OTP token. Please try again.");
      }
    } catch (err) {
      setErrorMsg("MFA verification failure. Payout blocked.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="max-w-md w-full bg-white border border-[#D9E0E8] p-6 rounded-lg shadow-xl space-y-4">
        <div className="flex gap-3">
          <div className="p-2 bg-orange-50 border border-orange-200 text-orange-600 rounded shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">MFA Payout Release Authorization</h3>
            <p className="text-xs text-slate-500 mt-1">
              You are about to release <span className="font-semibold text-slate-800">${milestone.amount} USDC</span> from the escrow vault. Enter your 6-digit verification code.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input 
            type="text" 
            value={token} 
            onChange={(e) => setToken(e.target.value)}
            placeholder="000000"
            className="w-full border border-[#D9E0E8] rounded px-3 py-2 text-center text-sm font-mono font-bold tracking-widest focus:outline-none focus:border-[#2563EB] bg-white text-slate-900"
            maxLength={6}
            required
            autoFocus
          />

          {errorMsg && (
            <p className="text-[10px] font-semibold text-red-600 bg-red-50 p-2 border border-red-100 rounded text-center">
              {errorMsg}
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <button 
              type="button" 
              onClick={onClose}
              className="flex-1 py-2 border border-[#D9E0E8] hover:bg-slate-50 text-slate-700 text-xs font-bold rounded"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={submitting}
              className="flex-1 py-2 bg-slate-900 hover:bg-[#2563EB] text-white text-xs font-bold rounded transition-colors flex items-center justify-center gap-1.5"
            >
              {submitting && <RefreshCw size={12} className="animate-spin" />}
              Release Funds
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

---

## 🔌 4. API Integration Mapping

To connect these screens with the backend systems:
1. **Brief Parser Output**: Feed parsed briefs through `/api/leads/parse` utilizing the `ProjectPostSchema` model mapping.
2. **Opportunities Feed**: Call the `/api/opportunities` routing endpoint, which reads from the deduplicated database table populated by `discoveryService.ts` and `apifyClient.ts`.
3. **MFA State release**: Ensure all milestone release actions inside `MilestoneFunds.jsx` inject the `X-MFA-Token: <OTP_CODE>` header into the request payload:
   ```javascript
   const releaseMilestone = async (id, otp) => {
     await fetch(`/api/escrow/milestones/${id}/release`, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "X-MFA-Token": otp
       }
     });
   };
   ```
4. **Polygon Reputation DID Minting**: When triggering SBT minting inside `OutcomeEvidence.jsx`, retrieve transaction logs and standard IPFS attributes from `reputationCalculator.js`.
