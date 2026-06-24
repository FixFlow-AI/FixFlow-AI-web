# FixFlow AI - Frontend Gaps and Requirements Specification

This document details the functional and non-functional requirements for the **remaining frontend implementations** of FixFlow AI. It bridges the gap between the existing frontend Single Page Application (SPA) and the backend/system specifications.

---

## 🗺️ 1. Architecture Alignment & Gap Analysis

Currently, the frontend SPA provides interactive mock views for key dashboard areas. To fully support the backend systems specified in the [skills.md](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/docs/specifications/core_subsystems/skills.md) and [opportunity_intelligence_implementation.md](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/docs/specifications/core_subsystems/opportunity_intelligence_implementation.md) manuals, the frontend requires several net-new views and interaction flows.

```
┌────────────────────────────────────────────────────────────────────────────┐
│                    FIXFLOW AI FRONTEND SPA (DASHBOARD)                     │
│                                                                            │
│  [EXISTING VIEWS]        ──>   [GAPS / TARGET REQUIREMENT IMPLEMENTATIONS] │
│  ┌────────────────────┐        ┌────────────────────────────────────────┐  │
│  │ Overview           │        │ Opportunity Board (Discovery Feed)     │  │
│  │ Brief Ingestion    │        │ Client Claim Portal (Public /claim)    │  │
│  │ Proposal Generator │        │ Interview & Vetting Center (Dynamic)   │  │
│  │ Agreement Composer │        │ Contextual Contract Extensions Widget  │  │
│  │ Delivery Control   │        │ Settings: MFA Setup & Payout Auths     │  │
│  │ Milestone Funds    │        │ Web3 Wallet binding & Chain state      │  │
│  │ Outcome Reputation │        └────────────────────────────────────────┘  │
│  └────────────────────┘                                                    │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔍 2. Detailed Frontend Requirements

### 📋 Requirement 1: Interactive Opportunity Board (Discovery Feed)
*   **Target Subsystem**: Opportunity Intelligence Discovery & Ingestion.
*   **User Persona**: Freelancer.
*   **Description**: A feed where freelancers browse open-web opportunities collected from Tavily, Brave Search, SerpAPI, and Apify (Reddit, Hacker News, RSS feeds).

#### Layout & Visual Design
- **Editorial Aesthetic**: Follow the light-mode only, clean borders, minimal color rule defined in the [landing_page_redesign_implementation_plan.md](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/docs/specifications/product_strategy/landing_page_redesign_implementation_plan.md).
- **Core Widgets**:
  1. **Control Panel**: Filter by skills (e.g., React, Go, PyTorch), budget ranges, and sources (e.g., Google Jobs, WeWorkRemotely, Hacker News). Toggle sorting by `Recency` or `OpportunityScore`.
  2. **Opportunity Cards**: List items displaying:
     - Project title, description snippet, and timestamp.
     - Enriched Apollo.io details (company name, domain, estimated size, funding round, and tech stack).
     - Source attribution badge (with link to the original post).
  3. **Opportunity Score Breakdown**: A compact hover/tooltip popover decomposing the `OpportunityScore`:
     - **SkillMatch** (e.g., 90%)
     - **BudgetFit** (e.g., 85%)
     - **Recency** (e.g., 95%)
     - **BriefQuality** (e.g., 80%)
     - **Scam Penalty** (e.g., -0%)
     - **Client Trust Score** (e.g., 85%)
- **Actions**:
  - `Draft Proposal`: Launches the Proposal Builder with the opportunity context pre-filled.
  - `Apply on Source`: External link out to the target platform.

---

### 🔑 Requirement 2: Client Claim Project Portal
*   **Target Subsystem**: Client Ingestion / Onboarding.
*   **User Persona**: External Client.
*   **Description**: A public landing page where an external client who received a proposal or is invited off-platform can "claim" their workspace.

#### Layout & Visual Design
- **Path**: Accessible via `#/claim/:proposalId`.
- **Core Elements**:
  1. **Proposal Summary Card**: Shows the freelancer's identity, the proposed project summary, scoped milestones, and budget.
  2. **Security Gate**: Email input box. Triggers an verification OTP token to the client's email (stored on the associated `Lead`).
  3. **Ingestion Consent**: Checkbox verifying: *"I consent to migrating this project proposal to FixFlow AI and understand the workspace escrow terms."*
  4. **Workspace Ingress**: Upon validation, transitions the client into the role of the Workspace Owner, prompting them to fund Milestone 1.

---

### 🎙️ Requirement 3: Dynamic Vetting UI (The Interview Center)
*   **Target Subsystem**: Vetting & Screening (`interviewGenerator.ts`).
*   **User Persona**: Client & Freelancer.
*   **Description**: A two-sided interface that generates and displays customized technical vetting questions when the confidence grid spots missing matching skill details.

#### Layout & Visual Design
- **Client Interface**:
  - Displays missing skill gaps (e.g., *"Missing: Redis cluster replication experience"*).
  - Button: `Generate Tailored Vetting Questions` (calls backend).
  - Displays generated questions, expected answer keywords, and the candidate's answers once submitted.
- **Freelancer Interface**:
  - Renders a coding/text response screen showing the questions generated by Gemini.
  - Provides text inputs for each answer.
  - Submits responses back to the validation service.
- **Audit Panel**:
  - Displays the evaluation summary (Consensus Score, Match percentage, and specific flags for plagiarism or incorrect keywords).

---

### 🔁 Requirement 4: Contextual Workspace Extensions Widget
*   **Target Subsystem**: Retention & Churn Reduction (`contextExtensions.ts`).
*   **User Persona**: Client & Freelancer.
*   **Description**: Suggests follow-up phases or contract extensions automatically as the current contract milestones wrap up.

#### Layout & Visual Design
- **Placement**: Integrates into the bottom of [DeliveryControl.jsx](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/frontend/src/sections/dashboard/DeliveryControl.jsx) and triggers as a pop-up when the last milestone status transitions to `released`.
- **Core Elements**:
  - **Extension Recommendations**: Renders 2-3 specific milestone suggestions created from vector embedding analysis of the workspace chat and deliverables.
  - **Budget & Timeline Estimates**: Show recommended budget and delivery times for each.
  - **One-Click Repeat Offer**: Button that instantly creates a new Working Agreement draft pre-populated with these extension terms, bypassing manual proposal scoping.

---

### 🔐 Requirement 5: Secure MFA Escrow Verification & Settings
*   **Target Subsystem**: Escrow & Payout Security (`escrowStateMachine.ts` with `X-MFA-Token`).
*   **User Persona**: Client.
*   **Description**: Prevents session hijacking and unauthorized payout release by securing financial actions with Multi-Factor Authentication.

#### Layout & Visual Design
- **Settings Screen**:
  - MFA status toggle (Enabled/Disabled).
  - Shows QR code containing the authenticator secret URI, alongside the fallback text key.
  - Input field to test-verify the setup before enabling.
- **Milestone Funds Screen**:
  - When the client clicks `Approve Milestone` or `Release Funds` in [MilestoneFunds.jsx](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/frontend/src/sections/dashboard/MilestoneFunds.jsx), a modal appears.
  - Prompts: *"Enter the 6-digit MFA OTP from your authenticator app to authorize this transaction."*
  - Shows the SHA-256 state transition hash that will be signed on-ledger.

---

### 🌐 Requirement 6: Web3 Wallet Binding & Polygon Amoy Integrations
*   **Target Subsystem**: Reputation Minting & Decentralized Escrow.
*   **User Persona**: Freelancer & Client.
*   **Description**: Standard Web3 onboarding mechanics to connect wallet addresses and track Polygon network interactions.

#### Layout & Visual Design
- **Dashboard Sidebar/Header**:
  - Connect Wallet Button: Visual state changes once connected, showing the shortened address (e.g., `0x7a...49cf`) and an active green dot showing `Polygon Amoy`.
- **Onboarding (Role Setup)**:
  - Wallet authentication step during [RoleOnboarding.jsx](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/frontend/src/sections/dashboard/RoleOnboarding.jsx) mapping the connected public address to the `FreelancerProfile.walletAddresses` database field.
- **Minting Status Interface**:
  - Track minting steps (Metadata creation $\rightarrow$ Wallet signature request $\rightarrow$ Blockchain broadcast) inside [OutcomeEvidence.jsx](file:///c:/Users/suvam/Desktop/VS%20code/Projects/FixFlowAI/frontend/src/sections/dashboard/OutcomeEvidence.jsx).
  - Displays links to verification standards, transaction hashes, and on-chain Soulbound Token attributes.
