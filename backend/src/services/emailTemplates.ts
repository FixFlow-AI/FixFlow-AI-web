import type { Milestone } from '../skills/escrowStateMachine.js';
import type { UserRole } from '../services/userRepository.js';

/**
 * FixFlowAI Email Templates (STORY-36 expansion).
 *
 * Premium, branded HTML email templates for every business-critical
 * touchpoint. All templates use inline CSS only (email-client safe)
 * and render both HTML and plain-text variants.
 *
 * Sender: FixFlowAI <info@fixflowai.xyz> (no-reply)
 * Logo:   https://raw.githubusercontent.com/FixFlow-AI/FixFlow-AI/testing/public/logo.png
 */

// ─────────────────────────── Design tokens ────────────────────────────

const LOGO_URL =
  'https://raw.githubusercontent.com/FixFlow-AI/FixFlow-AI/testing/public/logo.png';

const PLATFORM_URL = process.env.PLATFORM_URL || 'https://fixflowai.xyz';
const DASHBOARD_URL = `${PLATFORM_URL}/#/dashboard`;

const BRAND = 'FixFlowAI';

const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  headerBgStart: '#0f172a',
  headerBgEnd: '#1e293b',
  body: '#ffffff',
  text: '#334155',
  textLight: '#64748b',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  footerBg: '#f8fafc',
  success: '#10b981',
  successBg: '#ecfdf5',
  warning: '#f59e0b',
  warningBg: '#fffbeb',
  danger: '#ef4444',
  dangerBg: '#fef2f2',
  accent: '#8b5cf6',
  cardBg: '#f1f5f9',
} as const;

// ─────────────────────────── Helpers ──────────────────────────────────

const inr = (n: number): string => `₹${Number(n || 0).toLocaleString('en-IN')}`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function ctaButton(label: string, url: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px auto">
    <tr>
      <td style="border-radius:8px;background:${COLORS.primary}">
        <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:'Inter','Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.3px">${label}</a>
      </td>
    </tr>
  </table>`;
}

function infoPill(label: string, value: string, color?: string): string {
  const bg = color || COLORS.cardBg;
  return `<span style="display:inline-block;padding:6px 14px;background:${bg};border-radius:20px;font-size:13px;font-weight:500;color:${COLORS.text};margin:4px 4px 4px 0">${label}: <strong>${escapeHtml(value)}</strong></span>`;
}

function skillBadge(skill: string): string {
  return `<span style="display:inline-block;padding:4px 12px;background:${COLORS.primary}12;color:${COLORS.primary};border-radius:16px;font-size:12px;font-weight:600;margin:3px 4px 3px 0;letter-spacing:0.2px">${escapeHtml(skill)}</span>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid ${COLORS.border};margin:24px 0"/>`;
}

// ─────────────────────────── Master layout ────────────────────────────

function masterLayout(preheader: string, bodyContent: string, footerNote?: string): string {
  const year = new Date().getFullYear();
  const footer = footerNote || `You're receiving this because you have an account on ${BRAND}.`;

  return `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${BRAND}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:'Inter','Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">
  <!-- Preheader (hidden in inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${escapeHtml(preheader)}&#8199;&#65279;&#847;</div>

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f1f5f9">
    <tr>
      <td align="center" style="padding:32px 16px">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;width:100%;background:${COLORS.body};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,${COLORS.headerBgStart},${COLORS.headerBgEnd});padding:28px 32px;text-align:center">
              <img src="${LOGO_URL}" alt="${BRAND}" width="140" style="display:inline-block;height:auto;max-width:140px;border:0"/>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;color:${COLORS.text};font-size:15px;line-height:1.7">
              ${bodyContent}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:${COLORS.footerBg};border-top:1px solid ${COLORS.border}">
              <p style="margin:0 0 8px;font-size:12px;color:${COLORS.textMuted};line-height:1.5;text-align:center">${footer}</p>
              <p style="margin:0;font-size:11px;color:${COLORS.textMuted};text-align:center">
                © ${year} ${BRAND} · Trust-first freelancing · <a href="${PLATFORM_URL}" style="color:${COLORS.primary};text-decoration:none">${PLATFORM_URL.replace(/^https?:\/\//, '')}</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:${COLORS.textMuted};text-align:center">
                This is an automated message — please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─────────────────────────── Template interface ───────────────────────

export interface EmailTemplate<TData> {
  subject: (data: TData) => string;
  html: (data: TData) => string;
  text: (data: TData) => string;
}

// ─────────────────────────── Data interfaces ─────────────────────────

export interface WelcomeData {
  name: string;
  role: UserRole;
  email: string;
}

export interface InvitationData {
  freelancerName: string;
  clientName: string;
  projectTitle: string;
  projectBrief: string;
  skills: string[];
}

export interface InvitationResponseData {
  clientName: string;
  freelancerName: string;
  projectTitle: string;
  accepted: boolean;
}

export interface GithubScanCompleteData {
  name: string;
  topSkills: string[];
  confidence: number;
  repoCount: number;
}

export interface InterviewScheduledData {
  freelancerName: string;
  clientName: string;
  projectTitle: string;
  timeLimit: string;
  questionCount: number;
}

export interface InterviewCompletedData {
  clientName: string;
  freelancerName: string;
  projectTitle: string;
  score: number;
  passed: boolean;
}

export interface ProposalEvaluatedData {
  clientName: string;
  projectTitle: string;
  confidenceScore: number;
}

export interface MilestoneEmailData {
  recipientName: string;
  milestoneTitle: string;
  amount: number;
  state: string;
  projectTitle?: string;
}

// ─────────────────────────── 1. Welcome (Freelancer) ─────────────────

export const welcomeFreelancerTemplate: EmailTemplate<WelcomeData> = {
  subject: (d) => `Welcome to ${BRAND}, ${d.name}! 🚀 Your skills speak for themselves`,

  html: (d) => masterLayout(
    `Welcome to ${BRAND} — your evidence-based freelancing profile is being built.`,
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.headerBgStart}">Welcome aboard, ${escapeHtml(d.name)}!</h1>
     <p style="margin:0 0 20px;font-size:15px;color:${COLORS.textLight}">Your journey to trust-first freelancing starts now.</p>

     <p>We're scanning your GitHub profile right now to build an <strong>evidence-based skill portfolio</strong> — no résumés, no guesswork. Here's what happens next:</p>

     <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0">
       <tr>
         <td style="padding:12px 16px;background:${COLORS.primary}08;border-left:3px solid ${COLORS.primary};border-radius:0 8px 8px 0;margin-bottom:8px">
           <strong style="color:${COLORS.primary}">Step 1</strong> · <span style="color:${COLORS.text}">AI analyzes your repos, commits, and code patterns</span>
         </td>
       </tr>
       <tr><td style="height:8px"></td></tr>
       <tr>
         <td style="padding:12px 16px;background:${COLORS.success}08;border-left:3px solid ${COLORS.success};border-radius:0 8px 8px 0">
           <strong style="color:${COLORS.success}">Step 2</strong> · <span style="color:${COLORS.text}">Your verified skill profile goes live on the platform</span>
         </td>
       </tr>
       <tr><td style="height:8px"></td></tr>
       <tr>
         <td style="padding:12px 16px;background:${COLORS.accent}08;border-left:3px solid ${COLORS.accent};border-radius:0 8px 8px 0">
           <strong style="color:${COLORS.accent}">Step 3</strong> · <span style="color:${COLORS.text}">Clients discover you — protected payments, zero noise</span>
         </td>
       </tr>
     </table>

     <p style="margin:16px 0 0;font-size:14px;color:${COLORS.textLight}">You'll receive another email once your GitHub scan is complete.</p>

     ${ctaButton('Go to Your Dashboard', DASHBOARD_URL)}`,
    `You're receiving this because you signed up for ${BRAND} with GitHub.`,
  ),

  text: (d) =>
    `Welcome to ${BRAND}, ${d.name}!\n\n` +
    `Your evidence-based freelancing profile is being built right now.\n\n` +
    `Step 1: AI analyzes your repos, commits, and code patterns\n` +
    `Step 2: Your verified skill profile goes live\n` +
    `Step 3: Clients discover you — protected payments, zero noise\n\n` +
    `You'll receive another email once your GitHub scan is complete.\n\n` +
    `Dashboard: ${DASHBOARD_URL}\n\n` +
    `— ${BRAND} Team`,
};

// ─────────────────────────── 2. Welcome (Client) ─────────────────────

export const welcomeClientTemplate: EmailTemplate<WelcomeData> = {
  subject: (d) => `Welcome to ${BRAND}, ${d.name}! 🎯 Hire with confidence`,

  html: (d) => masterLayout(
    `Welcome to ${BRAND} — evidence-based hiring, escrow-protected payments.`,
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.headerBgStart}">Welcome, ${escapeHtml(d.name)}!</h1>
     <p style="margin:0 0 20px;font-size:15px;color:${COLORS.textLight}">Trust-first hiring starts here.</p>

     <p>${BRAND} replaces résumé guesswork with <strong>verified skills</strong> and <strong>escrow-protected payments</strong>. Here's how to get started:</p>

     <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:20px 0">
       <tr>
         <td style="padding:12px 16px;background:${COLORS.primary}08;border-left:3px solid ${COLORS.primary};border-radius:0 8px 8px 0">
           <strong style="color:${COLORS.primary}">Post a brief</strong> · <span style="color:${COLORS.text}">Describe your project and our AI parses it into structured requirements</span>
         </td>
       </tr>
       <tr><td style="height:8px"></td></tr>
       <tr>
         <td style="padding:12px 16px;background:${COLORS.success}08;border-left:3px solid ${COLORS.success};border-radius:0 8px 8px 0">
           <strong style="color:${COLORS.success}">Get matched</strong> · <span style="color:${COLORS.text}">AI shortlists freelancers with verified GitHub-backed skills</span>
         </td>
       </tr>
       <tr><td style="height:8px"></td></tr>
       <tr>
         <td style="padding:12px 16px;background:${COLORS.accent}08;border-left:3px solid ${COLORS.accent};border-radius:0 8px 8px 0">
           <strong style="color:${COLORS.accent}">Pay securely</strong> · <span style="color:${COLORS.text}">Milestone-based escrow protects both you and the freelancer</span>
         </td>
       </tr>
     </table>

     ${ctaButton('Post Your First Brief', DASHBOARD_URL)}`,
    `You're receiving this because you signed up for ${BRAND} with Google.`,
  ),

  text: (d) =>
    `Welcome to ${BRAND}, ${d.name}!\n\n` +
    `Trust-first hiring starts here.\n\n` +
    `1. Post a brief — AI parses it into structured requirements\n` +
    `2. Get matched — freelancers with verified GitHub-backed skills\n` +
    `3. Pay securely — milestone-based escrow protects everyone\n\n` +
    `Get started: ${DASHBOARD_URL}\n\n` +
    `— ${BRAND} Team`,
};

// ─────────────────────────── 3. GitHub Scan Complete ─────────────────

export const githubScanCompleteTemplate: EmailTemplate<GithubScanCompleteData> = {
  subject: (d) => `Your ${BRAND} profile is ready! ${d.confidence >= 75 ? '✅' : '📊'} Confidence: ${d.confidence}%`,

  html: (d) => {
    const isStrong = d.confidence >= 75;
    const badgeColor = isStrong ? COLORS.success : COLORS.warning;
    const badgeBg = isStrong ? COLORS.successBg : COLORS.warningBg;

    return masterLayout(
      `Your GitHub scan is complete — ${d.topSkills.slice(0, 3).join(', ')} detected.`,
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.headerBgStart}">Your profile is ready, ${escapeHtml(d.name)}!</h1>
       <p style="margin:0 0 20px;font-size:15px;color:${COLORS.textLight}">We've analyzed your GitHub footprint. Here's what we found.</p>

       <!-- Confidence badge -->
       <div style="text-align:center;margin:24px 0">
         <div style="display:inline-block;padding:16px 32px;background:${badgeBg};border:2px solid ${badgeColor};border-radius:12px">
           <div style="font-size:32px;font-weight:800;color:${badgeColor}">${d.confidence}%</div>
           <div style="font-size:13px;color:${COLORS.textLight};margin-top:4px">Profile Confidence</div>
         </div>
       </div>

       <!-- Stats -->
       <div style="text-align:center;margin:16px 0">
         ${infoPill('Repos Analyzed', String(d.repoCount))}
       </div>

       ${divider()}

       <!-- Top Skills -->
       <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:${COLORS.headerBgStart}">Verified Skills</p>
       <div style="margin:0 0 20px">
         ${d.topSkills.map(skillBadge).join('')}
       </div>

       ${!isStrong ? `<p style="margin:16px 0 0;padding:12px 16px;background:${COLORS.warningBg};border-radius:8px;font-size:13px;color:${COLORS.text}">
         💡 <strong>Tip:</strong> Push more code to public repos to boost your confidence score. More recent commits carry higher weight.
       </p>` : ''}

       ${ctaButton('View Your Full Profile', DASHBOARD_URL)}`,
      `Your GitHub profile was scanned to build your ${BRAND} skill portfolio.`,
    );
  },

  text: (d) =>
    `Your ${BRAND} profile is ready, ${d.name}!\n\n` +
    `Profile Confidence: ${d.confidence}%\n` +
    `Repos Analyzed: ${d.repoCount}\n` +
    `Top Skills: ${d.topSkills.join(', ')}\n\n` +
    `View your profile: ${DASHBOARD_URL}\n\n` +
    `— ${BRAND} Team`,
};

// ─────────────────────────── 4. Project Invitation ───────────────────

export const projectInvitationTemplate: EmailTemplate<InvitationData> = {
  subject: (d) => `${escapeHtml(d.clientName)} invited you to a project on ${BRAND}`,

  html: (d) => masterLayout(
    `You've been invited to "${d.projectTitle}" by ${d.clientName}.`,
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.headerBgStart}">You've been invited! 🎉</h1>
     <p style="margin:0 0 20px;font-size:15px;color:${COLORS.textLight}"><strong>${escapeHtml(d.clientName)}</strong> has selected you for a project on ${BRAND}.</p>

     <!-- Project card -->
     <div style="padding:20px;background:${COLORS.cardBg};border-radius:12px;border:1px solid ${COLORS.border};margin:16px 0">
       <h2 style="margin:0 0 8px;font-size:17px;font-weight:700;color:${COLORS.headerBgStart}">${escapeHtml(d.projectTitle)}</h2>
       <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:${COLORS.text}">${escapeHtml(d.projectBrief.slice(0, 300))}${d.projectBrief.length > 300 ? '…' : ''}</p>

       <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${COLORS.textLight}">Required Skills</p>
       <div>${d.skills.map(skillBadge).join('')}</div>
     </div>

     <p style="margin:16px 0 0;font-size:14px;color:${COLORS.text}">Log in to review the project details, accept the invitation, and start the conversation with <strong>${escapeHtml(d.clientName)}</strong>.</p>

     ${ctaButton('View Invitation', DASHBOARD_URL)}`,
    `You're receiving this because a client invited you to a project on ${BRAND}.`,
  ),

  text: (d) =>
    `You've been invited to a project on ${BRAND}!\n\n` +
    `Client: ${d.clientName}\n` +
    `Project: ${d.projectTitle}\n` +
    `Brief: ${d.projectBrief.slice(0, 300)}\n` +
    `Skills: ${d.skills.join(', ')}\n\n` +
    `View invitation: ${DASHBOARD_URL}\n\n` +
    `— ${BRAND} Team`,
};

// ──────────────── 4b. Invitation Response (freelancer → client) ───────

export const invitationResponseTemplate: EmailTemplate<InvitationResponseData> = {
  subject: (d) =>
    d.accepted
      ? `${escapeHtml(d.freelancerName)} accepted your invitation — ${escapeHtml(d.projectTitle)}`
      : `${escapeHtml(d.freelancerName)} declined your invitation — ${escapeHtml(d.projectTitle)}`,

  html: (d) => masterLayout(
    d.accepted
      ? `${d.freelancerName} accepted your invitation to ${d.projectTitle}.`
      : `${d.freelancerName} declined your invitation to ${d.projectTitle}.`,
    d.accepted
      ? `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.headerBgStart}">Invitation accepted ✅</h1>
         <p style="margin:0 0 20px;font-size:15px;color:${COLORS.textLight}">Hi ${escapeHtml(d.clientName)}, <strong>${escapeHtml(d.freelancerName)}</strong> has accepted your invitation.</p>

         <div style="padding:20px;background:${COLORS.cardBg};border-radius:12px;border:1px solid ${COLORS.border};margin:16px 0">
           <h2 style="margin:0 0 8px;font-size:17px;font-weight:700;color:${COLORS.headerBgStart}">${escapeHtml(d.projectTitle)}</h2>
           <p style="margin:0;font-size:14px;line-height:1.6;color:${COLORS.text}">Both sides have now agreed to talk. You can review their evidence, run a screening interview, or move straight to a working agreement.</p>
         </div>

         <p style="margin:16px 0 0;font-size:14px;color:${COLORS.text}">Nothing is committed until you approve the agreement and fund the first milestone.</p>

         ${ctaButton('Review and continue', DASHBOARD_URL)}`
      : `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.headerBgStart}">Invitation declined</h1>
         <p style="margin:0 0 20px;font-size:15px;color:${COLORS.textLight}">Hi ${escapeHtml(d.clientName)}, <strong>${escapeHtml(d.freelancerName)}</strong> has declined your invitation to <strong>${escapeHtml(d.projectTitle)}</strong>.</p>
         <p style="margin:0 0 16px;font-size:14px;color:${COLORS.text}">Your shortlist is unchanged, so you can invite another candidate whenever you're ready.</p>

         ${ctaButton('View your shortlist', DASHBOARD_URL)}`,
    `You're receiving this because you invited a freelancer to a project on ${BRAND}.`,
  ),

  text: (d) =>
    (d.accepted
      ? `${d.freelancerName} ACCEPTED your invitation.\n\n`
      : `${d.freelancerName} declined your invitation.\n\n`) +
    `Project: ${d.projectTitle}\n\n` +
    (d.accepted
      ? `Both sides have agreed to talk. Next: review evidence, optionally interview, then move to a working agreement. Nothing is committed until you approve the agreement and fund the first milestone.\n\n`
      : `Your shortlist is unchanged — you can invite another candidate any time.\n\n`) +
    `Open ${BRAND}: ${DASHBOARD_URL}\n\n` +
    `— ${BRAND} Team`,
};

// ─────────────────────────── 5. Interview Scheduled ──────────────────

export const interviewScheduledTemplate: EmailTemplate<InterviewScheduledData> = {
  subject: (d) => `Interview scheduled: ${d.projectTitle} — ${BRAND}`,

  html: (d) => masterLayout(
    `${d.clientName} has set up a screening interview for ${d.projectTitle}.`,
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.headerBgStart}">Interview Ready 📝</h1>
     <p style="margin:0 0 20px;font-size:15px;color:${COLORS.textLight}">Hi ${escapeHtml(d.freelancerName)}, a screening interview has been prepared for you.</p>

     <div style="padding:20px;background:${COLORS.cardBg};border-radius:12px;border:1px solid ${COLORS.border};margin:16px 0">
       <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%">
         <tr>
           <td style="padding:6px 0;font-size:14px;color:${COLORS.textLight};width:130px">Project</td>
           <td style="padding:6px 0;font-size:14px;font-weight:600;color:${COLORS.text}">${escapeHtml(d.projectTitle)}</td>
         </tr>
         <tr>
           <td style="padding:6px 0;font-size:14px;color:${COLORS.textLight}">Client</td>
           <td style="padding:6px 0;font-size:14px;font-weight:600;color:${COLORS.text}">${escapeHtml(d.clientName)}</td>
         </tr>
         <tr>
           <td style="padding:6px 0;font-size:14px;color:${COLORS.textLight}">Questions</td>
           <td style="padding:6px 0;font-size:14px;font-weight:600;color:${COLORS.text}">${d.questionCount} questions</td>
         </tr>
         <tr>
           <td style="padding:6px 0;font-size:14px;color:${COLORS.textLight}">Time Limit</td>
           <td style="padding:6px 0;font-size:14px;font-weight:600;color:${COLORS.text}">${escapeHtml(d.timeLimit)}</td>
         </tr>
       </table>
     </div>

     <div style="padding:12px 16px;background:${COLORS.warningBg};border-radius:8px;font-size:13px;color:${COLORS.text};margin:16px 0">
       ⚡ <strong>Note:</strong> This is a proctored interview. Ensure you have a stable internet connection, camera access, and a distraction-free environment before starting.
     </div>

     ${ctaButton('Start Interview', DASHBOARD_URL)}`,
    `You're receiving this because you were invited to an interview on ${BRAND}.`,
  ),

  text: (d) =>
    `Interview Scheduled — ${BRAND}\n\n` +
    `Hi ${d.freelancerName},\n\n` +
    `A screening interview has been prepared for "${d.projectTitle}" by ${d.clientName}.\n` +
    `Questions: ${d.questionCount}\n` +
    `Time Limit: ${d.timeLimit}\n\n` +
    `This is a proctored interview. Ensure a stable connection and camera access.\n\n` +
    `Start: ${DASHBOARD_URL}\n\n` +
    `— ${BRAND} Team`,
};

// ─────────────────────────── 6. Interview Completed ──────────────────

export const interviewCompletedTemplate: EmailTemplate<InterviewCompletedData> = {
  subject: (d) => `Interview results: ${d.freelancerName} — ${d.passed ? 'Passed ✅' : 'Did not pass'}`,

  html: (d) => {
    const statusColor = d.passed ? COLORS.success : COLORS.danger;
    const statusBg = d.passed ? COLORS.successBg : COLORS.dangerBg;
    const statusLabel = d.passed ? 'Passed' : 'Did Not Pass';

    return masterLayout(
      `${d.freelancerName}'s interview for "${d.projectTitle}" is complete — score: ${d.score}%.`,
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.headerBgStart}">Interview Complete</h1>
       <p style="margin:0 0 20px;font-size:15px;color:${COLORS.textLight}">Hi ${escapeHtml(d.clientName)}, here are the results for <strong>${escapeHtml(d.freelancerName)}</strong>.</p>

       <!-- Score card -->
       <div style="text-align:center;margin:24px 0">
         <div style="display:inline-block;padding:20px 36px;background:${statusBg};border:2px solid ${statusColor};border-radius:12px">
           <div style="font-size:36px;font-weight:800;color:${statusColor}">${d.score}%</div>
           <div style="font-size:14px;font-weight:600;color:${statusColor};margin-top:4px">${statusLabel}</div>
         </div>
       </div>

       <div style="padding:20px;background:${COLORS.cardBg};border-radius:12px;border:1px solid ${COLORS.border};margin:16px 0">
         <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%">
           <tr>
             <td style="padding:6px 0;font-size:14px;color:${COLORS.textLight};width:130px">Candidate</td>
             <td style="padding:6px 0;font-size:14px;font-weight:600;color:${COLORS.text}">${escapeHtml(d.freelancerName)}</td>
           </tr>
           <tr>
             <td style="padding:6px 0;font-size:14px;color:${COLORS.textLight}">Project</td>
             <td style="padding:6px 0;font-size:14px;font-weight:600;color:${COLORS.text}">${escapeHtml(d.projectTitle)}</td>
           </tr>
         </table>
       </div>

       ${ctaButton('Review Full Results', DASHBOARD_URL)}`,
      `You're receiving this because a candidate completed an interview on ${BRAND}.`,
    );
  },

  text: (d) =>
    `Interview Complete — ${BRAND}\n\n` +
    `Hi ${d.clientName},\n\n` +
    `${d.freelancerName}'s interview for "${d.projectTitle}" is complete.\n` +
    `Score: ${d.score}%\n` +
    `Result: ${d.passed ? 'Passed' : 'Did not pass'}\n\n` +
    `Review: ${DASHBOARD_URL}\n\n` +
    `— ${BRAND} Team`,
};

// ─────────────────────────── 7. Proposal Evaluated ───────────────────

export const proposalEvaluatedTemplate: EmailTemplate<ProposalEvaluatedData> = {
  subject: (d) => `Proposal evaluated: ${d.projectTitle} — Confidence ${d.confidenceScore}%`,

  html: (d) => {
    const isStrong = d.confidenceScore >= 75;
    const scoreColor = isStrong ? COLORS.success : d.confidenceScore >= 50 ? COLORS.warning : COLORS.danger;
    const scoreBg = isStrong ? COLORS.successBg : d.confidenceScore >= 50 ? COLORS.warningBg : COLORS.dangerBg;

    return masterLayout(
      `Your proposal for "${d.projectTitle}" has been evaluated — confidence: ${d.confidenceScore}%.`,
      `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.headerBgStart}">Proposal Evaluation Ready</h1>
       <p style="margin:0 0 20px;font-size:15px;color:${COLORS.textLight}">Hi ${escapeHtml(d.clientName)}, our AI has evaluated your proposal.</p>

       <div style="text-align:center;margin:24px 0">
         <div style="display:inline-block;padding:16px 32px;background:${scoreBg};border:2px solid ${scoreColor};border-radius:12px">
           <div style="font-size:32px;font-weight:800;color:${scoreColor}">${d.confidenceScore}%</div>
           <div style="font-size:13px;color:${COLORS.textLight};margin-top:4px">Confidence Index</div>
         </div>
       </div>

       <div style="padding:20px;background:${COLORS.cardBg};border-radius:12px;border:1px solid ${COLORS.border};margin:16px 0">
         <p style="margin:0;font-size:14px;color:${COLORS.text}"><strong>Project:</strong> ${escapeHtml(d.projectTitle)}</p>
       </div>

       <p style="margin:16px 0 0;font-size:14px;color:${COLORS.text}">The confidence index reflects feasibility, scope clarity, and risk analysis. View the full breakdown in your dashboard.</p>

       ${ctaButton('View Evaluation Details', DASHBOARD_URL)}`,
      `You're receiving this because a proposal was evaluated on ${BRAND}.`,
    );
  },

  text: (d) =>
    `Proposal Evaluated — ${BRAND}\n\n` +
    `Hi ${d.clientName},\n\n` +
    `Project: ${d.projectTitle}\n` +
    `Confidence Index: ${d.confidenceScore}%\n\n` +
    `View details: ${DASHBOARD_URL}\n\n` +
    `— ${BRAND} Team`,
};

// ─────────────────────────── 8–13. Milestone Events ──────────────────

export type MilestoneEmailEvent =
  | 'funded'
  | 'submitted'
  | 'approved'
  | 'revision_requested'
  | 'released'
  | 'dispute_raised'
  | 'dispute_resolved'
  | 'refunded';

interface MilestoneTemplateCopy {
  icon: string;
  title: (m: Milestone) => string;
  line: (m: Milestone) => string;
  statusColor: string;
  statusBg: string;
}

const MILESTONE_COPY: Record<MilestoneEmailEvent, MilestoneTemplateCopy> = {
  funded: {
    icon: '💰',
    title: (m) => `Milestone Funded: ${m.title}`,
    line: (m) => `Funds of ${inr(m.amount)} for <strong>${escapeHtml(m.title)}</strong> are now secured in escrow. Work can begin.`,
    statusColor: COLORS.success,
    statusBg: COLORS.successBg,
  },
  submitted: {
    icon: '📦',
    title: (m) => `Deliverable Submitted: ${m.title}`,
    line: (m) => `The freelancer submitted work for <strong>${escapeHtml(m.title)}</strong>. Please review and approve or request changes.`,
    statusColor: COLORS.primary,
    statusBg: `${COLORS.primary}10`,
  },
  approved: {
    icon: '✅',
    title: (m) => `Milestone Approved: ${m.title}`,
    line: (m) => `<strong>${escapeHtml(m.title)}</strong> was approved. Funds are ready to be released to the freelancer.`,
    statusColor: COLORS.success,
    statusBg: COLORS.successBg,
  },
  revision_requested: {
    icon: '🔄',
    title: (m) => `Revision Requested: ${m.title}`,
    line: (m) => `The client requested changes on <strong>${escapeHtml(m.title)}</strong>. Please review the feedback and resubmit.`,
    statusColor: COLORS.warning,
    statusBg: COLORS.warningBg,
  },
  released: {
    icon: '🎉',
    title: (m) => `Funds Released: ${m.title}`,
    line: (m) => `Escrow funds of ${inr(m.amount)} for <strong>${escapeHtml(m.title)}</strong> have been released to the freelancer's account.`,
    statusColor: COLORS.success,
    statusBg: COLORS.successBg,
  },
  dispute_raised: {
    icon: '⚠️',
    title: (m) => `Dispute Opened: ${m.title}`,
    line: (m) => `A dispute was raised on <strong>${escapeHtml(m.title)}</strong>. Funds of ${inr(m.amount)} remain locked in escrow pending resolution.`,
    statusColor: COLORS.danger,
    statusBg: COLORS.dangerBg,
  },
  dispute_resolved: {
    icon: '✅',
    title: (m) => `Dispute Resolved: ${m.title}`,
    line: (m) => `The dispute on <strong>${escapeHtml(m.title)}</strong> has been resolved.`,
    statusColor: COLORS.success,
    statusBg: COLORS.successBg,
  },
  refunded: {
    icon: '↩️',
    title: (m) => `Refund Issued: ${m.title}`,
    line: (m) => `A refund of ${inr(m.amount)} for <strong>${escapeHtml(m.title)}</strong> has been issued to the client's original payment method.`,
    statusColor: COLORS.warning,
    statusBg: COLORS.warningBg,
  },
};

export function buildMilestoneEmail(
  event: MilestoneEmailEvent,
  milestone: Milestone,
): { subject: string; html: string; text: string } | null {
  const copy = MILESTONE_COPY[event];
  if (!copy) return null;

  const subject = `${copy.icon} ${copy.title(milestone)}`;

  const html = masterLayout(
    stripHtml(copy.line(milestone)),
    `<h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:${COLORS.headerBgStart}">${copy.icon} ${escapeHtml(copy.title(milestone))}</h1>

     <p style="margin:16px 0;font-size:15px;line-height:1.7;color:${COLORS.text}">${copy.line(milestone)}</p>

     <!-- Status card -->
     <div style="padding:16px 20px;background:${copy.statusBg};border-radius:10px;border:1px solid ${copy.statusColor}20;margin:20px 0">
       <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="width:100%">
         <tr>
           <td style="padding:4px 0;font-size:14px;color:${COLORS.textLight};width:100px">Status</td>
           <td style="padding:4px 0;font-size:14px;font-weight:700;color:${copy.statusColor}">${escapeHtml(milestone.state)}</td>
         </tr>
         <tr>
           <td style="padding:4px 0;font-size:14px;color:${COLORS.textLight}">Amount</td>
           <td style="padding:4px 0;font-size:14px;font-weight:700;color:${COLORS.text}">${inr(milestone.amount)}</td>
         </tr>
       </table>
     </div>

     ${ctaButton('View Milestone', DASHBOARD_URL)}`,
    `You're receiving this because you have an active project on ${BRAND}.`,
  );

  const text =
    `${copy.title(milestone)}\n\n` +
    `${stripHtml(copy.line(milestone))}\n\n` +
    `Status: ${milestone.state}\n` +
    `Amount: ${inr(milestone.amount)}\n\n` +
    `Dashboard: ${DASHBOARD_URL}\n\n` +
    `— ${BRAND} Team`;

  return { subject, html, text };
}
