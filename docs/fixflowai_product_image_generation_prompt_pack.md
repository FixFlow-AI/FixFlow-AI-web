# FixFlowAI Product Image Generation Prompt Pack

## 1. Purpose

Use this document to generate realistic internal FixFlowAI product screens with ChatGPT Images. These screens are intended to sit between landing-page sections and make the underlying product workflow visible.

The images must look like believable product states, not decorative illustrations, generic AI dashboards, stock photos, or replicas of existing freelance marketplaces.

The full set tells one continuous story:

1. A project request enters FixFlowAI.
2. The brief becomes structured and risks become visible.
3. Relevant work evidence is connected to requirements.
4. A working agreement is composed and approved.
5. Delivery, changes, approval, and protected funds remain connected.
6. The accepted outcome becomes a durable evidence trail.

Generate one screen per prompt. Do not ask the image model to create all screens in one image.

---

## 2. Files to attach to ChatGPT

### Minimum attachment set for every image

Attach these three files with every section prompt:

1. **Official logo**  
   `frontend/public/official-logo.png`

2. **Landing-page source-of-truth specification**  
   `docs/landing_page_redesign_implementation_plan.md`

3. **Primary visual style reference**  
   `docs/assets/landing-concepts/01-hero-problem.png`

### Best-context attachment set

For the most consistent result, also attach:

4. **Product positioning and real feature context**  
   `docs/market_positioning_and_uvps.md`

5. **The section-specific visual reference listed with each prompt**  
   Choose one of:
   - `docs/assets/landing-concepts/02-system-intelligence.png`
   - `docs/assets/landing-concepts/03-workflow-automation.png`
   - `docs/assets/landing-concepts/04-trust-cta.png`

### What not to attach

Do not attach the old dark landing-page implementation or old glassmorphism screenshots. They conflict with the new white editorial design system and will cause visual drift.

Do not attach competitor screenshots as style references. Competitor research should influence workflow completeness, not the final visual language.

### Best single file to attach with this prompt pack

If ChatGPT accepts only one context document in addition to the logo, attach:

`docs/landing_page_redesign_implementation_plan.md`

It contains the full product narrative, exact color system, typography rules, interaction model, section order, and product constraints.

---

## 3. Research basis

The prompt structure adopts useful product behaviors found in official product documentation while deliberately avoiding their visual layouts.

- Upwork separates contract work into a workroom and gives fixed-price work explicit milestone review, payment, and release states.
- Fiverr milestone orders make sequential deliverables and approval progress visible.
- Freelancer.com treats milestone creation and release as explicit project events.
- Contra guides clients through project creation and distinguishes fixed, hourly, invoice, and escrow project types.
- Linear project overviews keep summaries, descriptions, resources, documents, milestones, and project updates together.
- GitHub Projects and repository activity connect work items to issues, pull requests, deployments, and contribution history.
- Stripe Connect documentation demonstrates that platform payment state and transfer state require clear separation and explicit status language.

### Design lessons adopted for FixFlowAI

1. **Project context must be persistent.** The project name and current agreement state remain visible on every screen.
2. **Milestones need observable states.** Draft, approval, funded, in progress, submitted, revision, accepted, and released must be distinguishable.
3. **Evidence should be attached to requirements.** A repository or work sample is not useful unless the interface explains which requirement it supports.
4. **Changes need their own record.** Scope changes must not disappear into chat.
5. **Payments are states, not decorative balances.** Show who must act and what condition changes the state.
6. **The outcome closes the loop.** Accepted work should create a structured proof event for future matching.

### Official sources reviewed

- [Upwork fixed-price milestones](https://support.upwork.com/hc/en-us/articles/211068218-How-to-use-milestones-in-fixed-price-jobs)
- [Upwork contract workroom](https://support.upwork.com/hc/en-us/articles/6033145650963-How-to-use-your-contract-workroom-as-a-freelancer)
- [Fiverr milestones](https://help.fiverr.com/hc/en-us/articles/4414438601873-Milestones)
- [Freelancer.com milestone payment creation](https://www.freelancer.com/support/Payments/how-to-create-a-milestone-payment)
- [Contra project documentation](https://client-help.contra.com/en/collections/10106057-projects)
- [Contra one-time escrow projects](https://client-help.contra.com/en/articles/9708266-navigating-one-time-escrow-projects)
- [Linear project overview](https://linear.app/docs/project-overview)
- [Linear project documents](https://linear.app/docs/project-documents)
- [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects/learning-about-projects/about-projects)
- [GitHub repository activity](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository)
- [Stripe Connect charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers)

---

## 4. Shared fictional project data

Use the same fictional project in every generated screen. Consistent project data makes separate images feel like one real product walkthrough.

### Workspace

- Client company: `Atlas Commerce`
- Project: `Northstar Billing Migration`
- Client lead: `Elena Park`
- Delivery lead: `Maya Chen`
- Agency: `Northline Studio`
- Project type: `Fixed-scope software migration`
- Current stage: changes per screen

### Project objective

`Move the billing service without interrupting active subscriptions.`

### Core requirements

- Preserve active subscription state.
- Make webhook processing idempotent.
- Provide a tested rollback plan.
- Reconcile migrated billing records.
- Complete the change within six weeks.

### Known risks

- Rollback ownership is initially unclear.
- Data reconciliation rules need client approval.
- The target runtime version needs confirmation.

### Relevant evidence

- Repository: `billing-migration`
- Proof event: `Recovered webhook delivery without duplicate charges`
- Proof event: `Completed a subscription migration with rollback coverage`
- Delivery artifact: `Reconciliation test report`

### Milestones

1. `Migration plan and rollback design`
2. `Webhook and reconciliation implementation`
3. `Production cutover and acceptance`

### Acceptance criteria for milestone 1

- Dependency map is complete.
- Rollback owner is named.
- Reconciliation test cases are approved.

---

## 5. Global visual system for every prompt

Every generated image must obey these rules.

### Format

- Use case: `ui-mockup`
- Output: full-screen product interface screenshot
- Size: `1536 x 1024` pixels
- Aspect ratio: `3:2`
- Format: PNG
- Camera: straight-on orthographic screen view
- No browser chrome, laptop frame, phone frame, desk, hands, or environmental scene
- Keep all essential content inside a 70-pixel safe area

### Product shell

- Full-screen internal application, not a floating dashboard card
- Quiet top bar with official FixFlowAI logo, product name, project breadcrumb, and one or two relevant controls
- Narrow left navigation with these items where appropriate:
  - Overview
  - Brief
  - Evidence
  - Agreement
  - Delivery
  - Funds
  - Outcomes
- Active navigation item uses a blue left rule or blue text, not a rounded pill
- Main work area uses open bands, ruled tables, timelines, inspectors, or one purposeful canvas
- No nested cards

### Color

- Main canvas: true white `#FFFFFF`
- Secondary band: cool gray `#F7F8FA`
- Interface surface: `#F1F5F9`
- Primary text: `#0F172A`
- Secondary text: `#64748B`
- Rules: `#D9E0E8`
- Active blue: `#2563EB`
- Verified green: `#16A34A`
- Risk orange: `#C2410C`
- Small secondary violet accent: `#6D4AFF`
- No cream, beige, glass, neon, blue-purple wash, or large gradients

### Geometry

- Maximum corner radius: 8px
- Buttons: 4px radius
- Tables and product canvases: 6-8px radius
- Thin structural borders
- Restrained shadows only on one primary workspace panel if needed
- No floating rounded widgets distributed around the screen

### Typography

- Clean modern sans serif similar to Inter
- Strong hierarchy with compact application headings
- Normal letter spacing
- Labels are concise and factual
- No huge landing-page typography inside product screens
- Use monospaced text only for repository names, IDs, and technical evidence

### Visual tone

- Optimistic because progress and completed states are visible
- Realistic because unresolved risk, ownership, evidence sources, and next actions are visible
- Calm, precise, and work-focused
- No fake analytics charts or vanity metrics
- No stock avatars; use initials only when a person indicator is necessary
- No AI sparkle decoration, robot icon, chatbot bubble, brain graphic, glowing node cloud, or magic-wand motif

### Exact-logo rule

Use the attached official logo exactly. Do not redraw, reinterpret, simplify, recolor, or generate a replacement logo. The brand name must read exactly `FixFlowAI`.

### Text accuracy rule

Render all quoted text exactly. Use only the text explicitly provided in the prompt. Prioritize crisp, readable labels over decorative density. If any critical word is misspelled, regenerate the screen instead of accepting it.

---

## 6. Reusable master prompt

Paste this master prompt before any section-specific prompt.

```text
Use case: ui-mockup
Asset type: realistic internal FixFlowAI product screen for a public landing page

Use the attached files as follows:
- official-logo.png is the exact production logo and must be used without alteration.
- landing_page_redesign_implementation_plan.md is the product, content, and visual source of truth.
- 01-hero-problem.png is a visual-system reference for whitespace, typography, line work, restraint, and color balance. Do not copy its approximate generated logo.
- Any additional attached section concept is a supporting reference for that specific workflow.

Create one full-screen desktop software interface at 1536 x 1024 pixels, straight-on, with no browser chrome and no device mockup. The image must look like a believable screenshot from the internal FixFlowAI application.

Product identity:
FixFlowAI turns a raw project request into a structured brief, proof-led match, working agreement, protected milestone workflow, shared delivery record, and evidence-backed reputation trail.

Audience:
Clients, freelancers, agencies, and software developers. The interface must feel useful to professional users making real project decisions.

Shared project data:
Client: “Atlas Commerce”
Project: “Northstar Billing Migration”
Objective: “Move the billing service without interrupting active subscriptions.”
Client lead: “Elena Park”
Delivery lead: “Maya Chen”
Agency: “Northline Studio”

Visual system:
- True white #FFFFFF main canvas
- Cool gray #F7F8FA section bands
- Surface #F1F5F9
- Ink #0F172A
- Muted text #64748B
- Rules #D9E0E8
- Active blue #2563EB
- Verified green #16A34A
- Risk orange #C2410C
- Violet #6D4AFF only as a small secondary accent
- Inter-like sans serif typography with normal letter spacing
- Maximum 8px corner radius, 4px buttons, thin structural rules
- Open editorial application layout, not a bento dashboard
- One coherent full-screen app shell, not many floating cards

Persistent product shell:
- Quiet top bar with the exact official logo, “FixFlowAI”, and project breadcrumb
- Narrow left navigation using relevant items from Overview, Brief, Evidence, Agreement, Delivery, Funds, Outcomes
- Active navigation shown with a blue rule or blue text, never a rounded pill
- Compact controls and realistic application typography

Required tone:
Optimistic, precise, calm, transparent, and operational. Show verified progress in green, current work in blue, and unresolved risk in orange. Make the user’s next action obvious.

Avoid:
No competitor logos or names. No Upwork, Fiverr, Freelancer, Contra, Toptal, or Braintrust layout imitation. No generic AI dashboard, chatbot, robot, glowing brain, sparkle decoration, glassmorphism, neon, gradient wash, floating orbs, nested cards, fake vanity chart, stock photo, device frame, browser chrome, oversized headline, marketing hero copy, testimonial, or unsupported metric.

Text rule:
Use only the exact labels and sample content in the section-specific prompt. Render critical labels sharply and verbatim. Keep secondary copy short enough to remain readable.
```

---

## 7. Prompt A: Unified Project Trust Overview

### Priority

**Highest priority.** Generate this first. It is the best single image for explaining FixFlowAI.

### Recommended landing-page placement

Place it after the hero and before the Problem section, or use it as the hero product visual if the code-native hero canvas is later replaced.

### Additional reference to attach

`docs/assets/landing-concepts/01-hero-problem.png`

### Suggested filename

`fixflow-product-overview-v1.png`

### Copy-paste section prompt

```text
SCREEN: Unified Project Trust Overview

Create the main project overview for “Northstar Billing Migration.” It must visualize the full FixFlowAI lifecycle in one calm, realistic screen without becoming a generic dashboard.

Layout:
- Persistent FixFlowAI top bar and left navigation.
- Main heading at application scale: “Northstar Billing Migration”
- Supporting line: “Atlas Commerce · Fixed-scope software migration”
- A narrow horizontal agreement path across the upper work area with six stages:
  “Brief” → “Evidence” → “Agreement” → “Build” → “Approval” → “Outcome”
- “Agreement” is the active stage in blue.
- “Brief” and “Evidence” are complete in green.
- Later stages remain neutral.
- Do not use oversized rounded stage pills; use a ruled process rail with compact labels.

Main content:
- Left two-thirds: an open “Project truth” workspace with four ruled rows:
  1. “Objective” — “Move the billing service without interrupting active subscriptions.”
  2. “Current decision” — “Approve rollback ownership”
  3. “Relevant proof” — “Subscription migration with rollback coverage”
  4. “Next milestone” — “Migration plan and rollback design”
- Right one-third: a compact “Agreement state” inspector with:
  “Scope” — “Ready for approval”
  “Acceptance criteria” — “3 defined”
  “Protected funds” — “Awaiting approval”
  “Open risks” — “2”
- Show one orange risk row labeled “Rollback owner not confirmed.”
- Show one green verified event labeled “Evidence linked to reliability requirement.”

Bottom band:
- A chronological evidence trail with four compact events:
  “Brief structured”
  “Proof connected”
  “Milestones drafted”
  “Client review required”
- Make “Client review required” the clear next action.

Visual objective:
The screen should immediately communicate that FixFlowAI is not only a talent marketplace. It is a connected trust and execution workspace that keeps brief, proof, agreement, funding state, delivery, and outcome together.
```

---

## 8. Prompt B: Brief Intelligence Workspace

### Recommended landing-page placement

Place it between the Problem and System Intelligence sections.

### Additional reference to attach

`docs/assets/landing-concepts/02-system-intelligence.png`

### Suggested filename

`fixflow-brief-intelligence-v1.png`

### Copy-paste section prompt

```text
SCREEN: Brief Intelligence Workspace

Create a realistic FixFlowAI screen that shows how an unstructured client request becomes a clear, reviewable project brief.

Active left-navigation item: “Brief”

Application heading:
“Brief intelligence”
Supporting line:
“Northstar Billing Migration · Source brief v1.2”

Use a three-region working layout, not three floating cards:

LEFT REGION — Original request
- Label: “Source request”
- Preserve this short client message exactly:
  “Move our billing service without interrupting active subscriptions. We need a safe rollback path and clear reconciliation before cutover.”
- Below it show two attached source items:
  “billing-context.pdf”
  “current-webhooks.csv”
- Include a subtle source marker: “Provided by Elena Park”

CENTER REGION — Structured brief
- Heading: “Parsed requirements”
- Use compact ruled rows with these exact items:
  “Preserve active subscription state” — green state “Confirmed”
  “Make webhook processing idempotent” — green state “Confirmed”
  “Provide a tested rollback plan” — blue state “In scope”
  “Reconcile migrated billing records” — blue state “In scope”
  “Complete within six weeks” — neutral state “Constraint”
- Add a compact summary rail above the rows:
  “4 outcomes” · “3 constraints” · “2 open decisions”

RIGHT REGION — Risk and clarification inspector
- Heading: “Needs a decision”
- Orange-highlighted item: “Who owns rollback approval?”
- Orange-highlighted item: “Which reconciliation variance is acceptable?”
- Neutral item: “Confirm target runtime version”
- Primary action button: “Request clarification”
- Secondary text action: “Mark as assumption”

Bottom system note:
“Every interpretation remains linked to the source request.”

Visual objective:
Show the transformation from messy intake to structured outcomes, constraints, risk, and next questions. The user must be able to see exactly what the system understood and what it did not assume.
```

---

## 9. Prompt C: Evidence Graph and Confidence Grid

### Recommended landing-page placement

Place it after System Intelligence and before How It Thinks.

### Additional reference to attach

`docs/assets/landing-concepts/02-system-intelligence.png`

### Suggested filename

`fixflow-evidence-confidence-v1.png`

### Copy-paste section prompt

```text
SCREEN: Evidence Graph and Confidence Grid

Create a realistic FixFlowAI screen that explains why a developer or agency is a relevant match. Do not show a talent directory, profile-card grid, star rating, or single opaque match score.

Active left-navigation item: “Evidence”

Application heading:
“Evidence connected to requirements”
Supporting line:
“Northline Studio · Review before shortlist”

Main composition:
- Left side: a vertical list of five project requirements.
- Center: a clean evidence relationship canvas with thin connecting lines.
- Right side: a confidence inspector organized by requirement.

LEFT — Requirements
Use these exact rows:
1. “Preserve subscription state”
2. “Idempotent webhook processing”
3. “Tested rollback plan”
4. “Billing reconciliation”
5. “Six-week delivery window”

CENTER — Evidence sources
Show these source nodes with restrained technical styling:
- “Repository: billing-migration”
- “Outcome: subscription cutover”
- “Artifact: rollback test suite”
- “Delivery record: 5-week migration”
- “Reference: platform engineering lead”

Draw meaningful lines only:
- “Repository: billing-migration” connects to “Idempotent webhook processing” and “Billing reconciliation.”
- “Outcome: subscription cutover” connects to “Preserve subscription state.”
- “Artifact: rollback test suite” connects to “Tested rollback plan.”
- “Delivery record: 5-week migration” connects to “Six-week delivery window.”

RIGHT — Confidence by requirement
Use a ruled matrix with these states:
- “Subscription state” — green “Strong evidence”
- “Webhook reliability” — green “Strong evidence”
- “Rollback design” — blue “Relevant evidence”
- “Reconciliation” — blue “Relevant evidence”
- “Target runtime” — orange “Open question”

Bottom action area:
- Primary action: “Add to shortlist”
- Secondary action: “Generate focused interview”
- System explanation: “Confidence is based on relevance, source strength, recency, and unresolved risk.”

Visual objective:
Make proof-led matching tangible. The interface should communicate that every confidence statement can be inspected and traced to evidence, while uncertainty remains visible.
```

---

## 10. Prompt D: Working Agreement Composer

### Recommended landing-page placement

Place it after How It Thinks and before the Workflow section.

### Additional reference to attach

`docs/assets/landing-concepts/03-workflow-automation.png`

### Suggested filename

`fixflow-agreement-composer-v1.png`

### Copy-paste section prompt

```text
SCREEN: Working Agreement Composer

Create a realistic FixFlowAI agreement-composer screen. It should feel like a professional collaborative document editor connected to project evidence, not a generic proposal template or legal-document image.

Active left-navigation item: “Agreement”

Top bar state:
“Draft v2.0”
Client: “Atlas Commerce”
Delivery team: “Northline Studio”

Application heading:
“Working agreement”
Supporting line:
“Scope, acceptance, ownership, and protected funds in one review.”

Layout:
- Main document canvas occupies about two-thirds of the screen.
- A structured inspector occupies the right third.
- Include a narrow document outline on the far left of the content area if space allows.

MAIN DOCUMENT CANVAS
Show these sections as open ruled document blocks:

“Objective”
“Move the billing service without interrupting active subscriptions.”

“Milestone 01 — Migration plan and rollback design”
Status: “Ready for approval”
Acceptance criteria:
- “Dependency map is complete”
- “Rollback owner is named”
- “Reconciliation test cases are approved”

“Assumptions”
- “Client provides current billing event samples”
- “Target runtime is confirmed before implementation”

“Out of scope”
- “Pricing model redesign”
- “Historical invoice correction”

RIGHT INSPECTOR
Heading: “Agreement check”
Show these exact rows:
- “Requirements covered” — green “5 of 5”
- “Acceptance criteria” — green “3 defined”
- “Unresolved assumptions” — orange “1”
- “Change process” — blue “Included”
- “Funding state” — neutral “Starts after approval”

Show one highlighted revision note:
“Client requested explicit rollback ownership.”

Actions:
- Primary: “Send for approval”
- Secondary: “Compare with v1.4”

Visual objective:
Show that FixFlowAI transforms the brief and proof into a mutual working agreement. The client should understand what will be delivered, how acceptance works, what is assumed, and which state comes next.
```

---

## 11. Prompt E: Shared Delivery and Change Control

### Recommended landing-page placement

Place it between the Workflow and Automation sections.

### Additional reference to attach

`docs/assets/landing-concepts/03-workflow-automation.png`

### Suggested filename

`fixflow-delivery-change-control-v1.png`

### Copy-paste section prompt

```text
SCREEN: Shared Delivery and Change Control

Create a realistic FixFlowAI project-delivery screen showing how clients, freelancers, agencies, and developers keep progress, files, decisions, and scope changes in one shared record.

Active left-navigation item: “Delivery”

Application heading:
“Milestone 02 — Webhook and reconciliation implementation”
Supporting line:
“In progress · Northstar Billing Migration”

Layout:
- Left side: milestone task and acceptance view.
- Center: chronological delivery activity.
- Right side: a focused change-control inspector.
- Avoid Kanban columns and generic task-card grids.

LEFT — Milestone definition
Show these rows:
- “Idempotent webhook handler” — green “Complete”
- “Reconciliation report” — blue “In review”
- “Failure replay test” — blue “In progress”
- “Cutover runbook” — neutral “Not started”

Acceptance summary:
“2 of 4 criteria currently evidenced”

CENTER — Delivery trail
Show a clean vertical event timeline:
- “Maya Chen linked pull request #184”
- “Reconciliation test report attached”
- “Elena Park requested a variance example”
- “Failure replay evidence submitted”
- “Change request CR-03 opened”

Use small file, code, decision, and change icons from one consistent outline family.

RIGHT — Change request CR-03
Heading: “Add regional tax reconciliation”
State: orange “Scope review”
Show a compact before-and-after diff:
- “Original” — “Reconcile billing records”
- “Requested” — “Reconcile billing records by tax region”
Impact rows:
- “Timeline” — “+3 working days”
- “Acceptance criteria” — “2 added”
- “Current milestone” — “Requires approval”

Actions:
- Primary: “Approve change”
- Secondary: “Keep original scope”

Bottom state rail:
“Agreement v2.0” → “Change CR-03” → “Client decision required”

Visual objective:
Show that delivery does not lose the agreement context. Scope changes become explicit records with impact, decision ownership, and a clear return path to the working agreement.
```

---

## 12. Prompt F: Protected Milestone Funds and Approval State

### Recommended landing-page placement

Place it inside or immediately after the Workflow section. Use it only once; do not repeat payment visuals elsewhere.

### Additional reference to attach

`docs/assets/landing-concepts/03-workflow-automation.png`

### Suggested filename

`fixflow-milestone-funds-v1.png`

### Copy-paste section prompt

```text
SCREEN: Protected Milestone Funds and Approval State

Create a realistic FixFlowAI funds-and-approval screen. The purpose is to explain milestone funding state, acceptance conditions, and the next responsible action. Do not create a banking dashboard, cryptocurrency interface, wallet balance screen, or financial trading visual.

Active left-navigation item: “Funds”

Application heading:
“Protected milestone state”
Supporting line:
“Northstar Billing Migration · Agreement v2.0”

Main visual:
Create one horizontal state machine across the upper half of the work area:
“Approved” → “Funding confirmed” → “Work in progress” → “Submitted” → “Accepted” → “Released”

State styling:
- “Approved” and “Funding confirmed” are complete in green.
- “Work in progress” is active in blue.
- Later states are neutral.
- Use a structural rail and compact status blocks, not large pills.

Below the state machine, show three ruled milestone rows:

“Milestone 01 — Migration plan and rollback design”
State: green “Released”
Evidence: “3 acceptance criteria met”

“Milestone 02 — Webhook and reconciliation implementation”
State: blue “Work in progress”
Evidence: “2 of 4 criteria evidenced”

“Milestone 03 — Production cutover and acceptance”
State: neutral “Not funded”
Evidence: “Begins after milestone 02 acceptance”

Right inspector:
Heading: “What changes this state”
- “Talent submits delivery evidence”
- “Client reviews agreed criteria”
- “Acceptance records the outcome”
- “Release follows the accepted milestone”

Show a clear note:
“Funds and delivery state remain linked to the approved agreement.”

Do not show a real bank name, card number, account number, financial provider logo, legal guarantee, interest, investment return, or unsupported security certification.

Visual objective:
Make payment protection understandable as an explicit project state connected to approval and acceptance, not as a disconnected invoice or decorative shield graphic.
```

---

## 13. Prompt G: Outcome Evidence and Reputation Trail

### Recommended landing-page placement

Place it in the Trust section before the final CTA.

### Additional reference to attach

`docs/assets/landing-concepts/04-trust-cta.png`

### Suggested filename

`fixflow-outcome-evidence-v1.png`

### Copy-paste section prompt

```text
SCREEN: Outcome Evidence and Reputation Trail

Create a realistic FixFlowAI outcome screen showing how accepted work becomes a traceable proof record for the client, freelancer, agency, and developer. Do not use star ratings, review cards, social-media feeds, celebratory confetti, or fake customer quotes.

Active left-navigation item: “Outcomes”

Application heading:
“Verified outcome record”
Supporting line:
“Northstar Billing Migration · Milestone 01 accepted”

Layout:
- Left side: outcome summary and acceptance result.
- Center: full evidence trail.
- Right side: reputation visibility and reuse controls.

LEFT — Accepted outcome
Show a restrained green verified state:
“Migration plan and rollback design”
“Accepted against 3 criteria”

Acceptance rows:
- “Dependency map is complete” — green “Verified”
- “Rollback owner is named” — green “Verified”
- “Reconciliation tests are approved” — green “Verified”

Outcome statement:
“The approved migration plan is ready for implementation.”

CENTER — Evidence trail
Create a precise vertical timeline with these eight events:
1. “Requirement captured”
2. “Risk acknowledged”
3. “Proof connected”
4. “Agreement approved”
5. “Milestone funded”
6. “Delivery submitted”
7. “Outcome accepted”
8. “Reputation updated”

Highlight “Outcome accepted” in green. Show thin source connections from:
- “Source brief v1.2”
- “Agreement v2.0”
- “Rollback design.pdf”
- “Client acceptance event”

RIGHT — Reputation record
Heading: “Reuse this proof”
Rows:
- “Requirement relevance” — “Billing migration”
- “Evidence type” — “Accepted outcome”
- “Visibility” — “Private to network”
- “Available for matching” — green “Yes”

Controls:
- Checked toggle: “Use for future recommendations”
- Unchecked toggle: “Show project name publicly”
- Text action: “Preview proof record”

Bottom note:
“Trust is a trail of sources, decisions, delivery evidence, and accepted outcomes.”

Visual objective:
Show the difference between a shallow profile badge and a durable, source-backed reputation event. The screen should feel credible and calm, with no gamification.
```

---

## 14. Prompt H: Role-Aware Onboarding Workspace

### Recommended landing-page placement

Optional. Place it directly before the final early-access CTA if the page needs stronger onboarding context.

### Additional reference to attach

`docs/assets/landing-concepts/04-trust-cta.png`

### Suggested filename

`fixflow-role-onboarding-v1.png`

### Copy-paste section prompt

```text
SCREEN: Role-Aware Onboarding Workspace

Create a realistic FixFlowAI onboarding screen that demonstrates how the product adapts to clients, freelancers, agencies, and developers without creating four separate products.

Application heading:
“Set up your FixFlowAI workspace”
Supporting line:
“Your role changes the evidence and workflow we ask for.”

Top role control:
Create a compact segmented control with four options:
“Client” · “Freelancer” · “Agency” · “Developer”
Make “Agency” active.

Left side — Onboarding progress
Use a vertical ruled step list:
1. “Organization” — green “Complete”
2. “Team and roles” — green “Complete”
3. “Work evidence” — blue “Current”
4. “Proposal defaults” — neutral “Next”
5. “Payment preferences” — neutral “Later”

Main work area — Agency evidence setup
Heading: “Connect team proof”
Show three structured rows:
- “Northstar API migration” — “Repository connected”
- “Commerce platform redesign” — “Outcome record added”
- “Billing reliability program” — “Reference requested”

Show a small assignment table:
“Maya Chen” — “Delivery lead” — “Migration systems”
“Noah Reed” — “Backend engineer” — “Webhook reliability”
“Iris Patel” — “QA lead” — “Reconciliation testing”

Right inspector — Why this matters
Show these exact statements:
- “Team evidence can support future recommendations.”
- “Proposal roles stay connected to verified work.”
- “Clients can inspect who is responsible before approval.”

Actions:
- Primary: “Continue to proposal defaults”
- Secondary: “Save and return later”

Visual objective:
Make onboarding feel purposeful and role-aware. It should clearly connect setup work to future matching, proposals, delivery ownership, and client confidence.
```

---

## 15. Optional mobile prompt

Generate mobile only after the desktop image is approved. Use the desktop screen as the reference image for an edit or responsive reinterpretation.

```text
Create a mobile responsive version of the attached approved FixFlowAI desktop product screen.

Output size: 1024 x 1536 pixels, portrait.

Preserve exactly:
- Official FixFlowAI logo
- Screen purpose and current workflow state
- All critical labels and status colors
- White editorial visual system
- Blue active, green verified, orange risk semantics
- Maximum 8px radius

Responsive transformation:
- Replace the persistent left navigation with a compact top bar and one menu icon.
- Keep the project breadcrumb visible.
- Convert horizontal state rails into vertical progress tracks.
- Convert tables into labeled row groups.
- Place the primary next action within the first viewport.
- Keep text at realistic mobile application sizes.
- Do not compress the desktop screen into unreadable miniature columns.

Avoid:
No phone device frame, no browser chrome, no floating cards, no extra marketing copy, and no content that was not present in the approved desktop screen.
```

---

## 16. Master form for future screens

Use this form when creating a new internal-page prompt that is not already covered above.

```text
SCREEN NAME:
[Short literal name]

LANDING-PAGE PLACEMENT:
[Section before] → [generated image] → [section after]

PRIMARY USER:
[Client / Freelancer / Agency / Developer / Shared]

USER JOB:
[One action the user is trying to complete]

CURRENT PROJECT STATE:
[Draft / Needs clarification / Review / Approved / Funded / In progress / Submitted / Accepted]

ONE VISUAL THESIS:
[The single idea the screen must make obvious]

PERSISTENT SHELL:
- Active navigation item:
- Project breadcrumb:
- Current state:

MAIN LAYOUT:
- Left region:
- Center region:
- Right region:
- Bottom state rail:

EXACT VISIBLE TEXT:
- Heading:
- Supporting line:
- Row labels:
- Status labels:
- Primary action:
- Secondary action:
- System explanation:

SOURCE/EVIDENCE OBJECTS:
- Requirement:
- Evidence source:
- Decision:
- Delivery artifact:
- Acceptance event:

STATUS COLOR RULES:
- Green means:
- Blue means:
- Orange means:
- Neutral means:

MUST NOT INCLUDE:
[Unsupported claims, irrelevant features, competitor patterns, decorative elements]

OUTPUT:
1536 x 1024 PNG, straight-on full-screen interface, no browser chrome, no device frame.
```

---

## 17. Recommended generation order

Generate and approve screens in this order:

1. `fixflow-product-overview-v1.png`
2. `fixflow-brief-intelligence-v1.png`
3. `fixflow-evidence-confidence-v1.png`
4. `fixflow-agreement-composer-v1.png`
5. `fixflow-delivery-change-control-v1.png`
6. `fixflow-milestone-funds-v1.png`
7. `fixflow-outcome-evidence-v1.png`
8. `fixflow-role-onboarding-v1.png`

The first image establishes the internal product shell. Attach the approved first image as an additional visual reference when generating every later image. This is the strongest way to maintain the same navigation, typography, density, logo treatment, and panel geometry across the set.

---

## 18. Landing-page usage recommendation

Do not place all eight images on the final landing page. That would turn the page into a screenshot gallery and weaken the editorial rhythm.

Recommended primary set:

1. **Unified Project Trust Overview** — first major product signal.
2. **Brief Intelligence Workspace** — demonstrates clarity before matching.
3. **Working Agreement Composer** — demonstrates the bridge from decision to execution.
4. **Shared Delivery and Change Control** — demonstrates operational value during work.
5. **Outcome Evidence and Reputation Trail** — demonstrates the trust loop after delivery.

Use Evidence and Confidence, Protected Milestone Funds, and Role-Aware Onboarding as alternate or supporting images if those sections need more explanation after browser testing.

### Image framing on the landing page

- Use stable 3:2 frames.
- Preserve the full interface; do not crop away navigation or status context.
- Place images in open full-width bands or one purposeful frame, not inside decorative cards.
- Use only a light border and restrained shadow.
- Do not overlay marketing text on top of the product screen.
- Add code-native section headings and captions outside the image.
- On mobile, show an approved portrait version or a carefully selected full-width crop that preserves the current action and state.

---

## 19. Quality-control checklist

Reject and regenerate an image when any answer is “no.”

- Does the attached official logo appear unchanged?
- Does the brand name read exactly `FixFlowAI`?
- Does the screen look like the same product as previously approved screens?
- Is the application full-screen without browser or device chrome?
- Is the page true white rather than cream, gray-beige, or purple tinted?
- Is the primary user action obvious?
- Is the current project state obvious?
- Can the user distinguish verified, active, risk, and neutral states without relying on color alone?
- Are requirements connected to proof, agreement, delivery, or outcomes in a meaningful way?
- Is all critical text legible and correctly spelled?
- Are corner radii 8px or less?
- Are there no nested cards, floating AI widgets, fake charts, or decorative blobs?
- Is the image original rather than a recognizable competitor clone?
- Are all sample claims clearly interface examples rather than real customer claims?
- Does the screen explain real FixFlowAI functionality in under five seconds?

---

## 20. What to send back for implementation

For each approved image, provide:

1. The original full-resolution PNG.
2. The exact prompt used.
3. The screen name from this document.
4. Any intentional text change made during generation.
5. Whether the image is approved for desktop, mobile, or both.

Do not resize, compress, screenshot, or convert the image before sending it back. The full-resolution source gives the implementation enough room for responsive framing and high-density displays.
