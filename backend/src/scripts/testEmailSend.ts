import { sendEmail } from '../services/emailService.js';
import {
  welcomeFreelancerTemplate,
  welcomeClientTemplate,
  githubScanCompleteTemplate,
  projectInvitationTemplate,
  interviewScheduledTemplate,
  interviewCompletedTemplate,
  proposalEvaluatedTemplate,
  buildMilestoneEmail,
  type MilestoneEmailEvent,
} from '../services/emailTemplates.js';
import type { Milestone } from '../skills/escrowStateMachine.js';

/**
 * CLI tool to test all FixFlowAI email templates.
 *
 * Usage:
 *   npx tsx src/scripts/testEmailSend.ts <template-name> <recipient-email>
 *   npx tsx src/scripts/testEmailSend.ts all <recipient-email>     # send all templates
 *   npx tsx src/scripts/testEmailSend.ts list                      # list available templates
 *
 * Examples:
 *   npx tsx src/scripts/testEmailSend.ts welcome_freelancer you@example.com
 *   npx tsx src/scripts/testEmailSend.ts milestone_funded you@example.com
 *   npx tsx src/scripts/testEmailSend.ts all you@example.com
 */

// ─────────────────────────── Sample data ──────────────────────────────

const SAMPLE_MILESTONE: Milestone = {
  id: 'ms_demo_001',
  proposalId: 'prop_demo_001',
  title: 'Landing Page UI Redesign',
  amount: 25000,
  state: 'Active',
  version: 3,
  lastAuditHash: 'abc123def456',
};

const TEMPLATES: Record<string, () => { subject: string; html: string; text: string }> = {
  welcome_freelancer: () => {
    const data = { name: 'Suvam', role: 'freelancer' as const, email: 'suvam@example.com' };
    return { subject: welcomeFreelancerTemplate.subject(data), html: welcomeFreelancerTemplate.html(data), text: welcomeFreelancerTemplate.text(data) };
  },
  welcome_client: () => {
    const data = { name: 'Priya Sharma', role: 'client' as const, email: 'priya@example.com' };
    return { subject: welcomeClientTemplate.subject(data), html: welcomeClientTemplate.html(data), text: welcomeClientTemplate.text(data) };
  },
  github_scan_complete: () => {
    const data = { name: 'Suvam', topSkills: ['TypeScript', 'React', 'Node.js', 'Python', 'PostgreSQL', 'AWS'], confidence: 87, repoCount: 42 };
    return { subject: githubScanCompleteTemplate.subject(data), html: githubScanCompleteTemplate.html(data), text: githubScanCompleteTemplate.text(data) };
  },
  github_scan_low: () => {
    const data = { name: 'New Developer', topSkills: ['JavaScript', 'HTML'], confidence: 45, repoCount: 5 };
    return { subject: githubScanCompleteTemplate.subject(data), html: githubScanCompleteTemplate.html(data), text: githubScanCompleteTemplate.text(data) };
  },
  project_invitation: () => {
    const data = {
      freelancerName: 'Suvam',
      clientName: 'TechCorp India',
      projectTitle: 'AI-Powered Dashboard for Supply Chain',
      projectBrief: 'We need a full-stack developer to build a real-time analytics dashboard for our supply chain operations. The dashboard should integrate with our existing APIs and provide predictive insights using machine learning models.',
      skills: ['React', 'Node.js', 'Python', 'Machine Learning', 'PostgreSQL'],
    };
    return { subject: projectInvitationTemplate.subject(data), html: projectInvitationTemplate.html(data), text: projectInvitationTemplate.text(data) };
  },
  interview_scheduled: () => {
    const data = {
      freelancerName: 'Suvam',
      clientName: 'TechCorp India',
      projectTitle: 'AI-Powered Dashboard for Supply Chain',
      timeLimit: '45 minutes',
      questionCount: 12,
    };
    return { subject: interviewScheduledTemplate.subject(data), html: interviewScheduledTemplate.html(data), text: interviewScheduledTemplate.text(data) };
  },
  interview_passed: () => {
    const data = { clientName: 'Priya Sharma', freelancerName: 'Suvam', projectTitle: 'AI-Powered Dashboard', score: 92, passed: true };
    return { subject: interviewCompletedTemplate.subject(data), html: interviewCompletedTemplate.html(data), text: interviewCompletedTemplate.text(data) };
  },
  interview_failed: () => {
    const data = { clientName: 'Priya Sharma', freelancerName: 'Aarav Patel', projectTitle: 'API Gateway Redesign', score: 38, passed: false };
    return { subject: interviewCompletedTemplate.subject(data), html: interviewCompletedTemplate.html(data), text: interviewCompletedTemplate.text(data) };
  },
  proposal_evaluated: () => {
    const data = { clientName: 'Priya Sharma', projectTitle: 'Supply Chain Analytics Platform', confidenceScore: 81 };
    return { subject: proposalEvaluatedTemplate.subject(data), html: proposalEvaluatedTemplate.html(data), text: proposalEvaluatedTemplate.text(data) };
  },
  milestone_funded: () => buildMilestoneEmail('funded', { ...SAMPLE_MILESTONE, state: 'Active' })!,
  milestone_submitted: () => buildMilestoneEmail('submitted', { ...SAMPLE_MILESTONE, state: 'In_Review' })!,
  milestone_approved: () => buildMilestoneEmail('approved', { ...SAMPLE_MILESTONE, state: 'Approved' })!,
  milestone_revision_requested: () => buildMilestoneEmail('revision_requested', { ...SAMPLE_MILESTONE, state: 'Revision_Requested' })!,
  milestone_released: () => buildMilestoneEmail('released', { ...SAMPLE_MILESTONE, state: 'Funds_Released' })!,
  milestone_dispute_raised: () => buildMilestoneEmail('dispute_raised', { ...SAMPLE_MILESTONE, state: 'Dispute' })!,
  milestone_dispute_resolved: () => buildMilestoneEmail('dispute_resolved', { ...SAMPLE_MILESTONE, state: 'Active' })!,
  milestone_refunded: () => buildMilestoneEmail('refunded', { ...SAMPLE_MILESTONE, state: 'Draft' })!,
};

// ─────────────────────────── CLI ──────────────────────────────────────

const TEMPLATE_NAMES = Object.keys(TEMPLATES);

function printList(): void {
  console.log('\n📧 Available email templates:\n');
  for (const name of TEMPLATE_NAMES) {
    console.log(`  • ${name}`);
  }
  console.log(`\n  • all  (send all ${TEMPLATE_NAMES.length} templates)\n`);
  console.log('Usage: npx tsx src/scripts/testEmailSend.ts <template-name> <recipient-email>\n');
}

async function main() {
  const [templateArg, recipient] = process.argv.slice(2);

  if (!templateArg || templateArg === 'list' || templateArg === '--help' || templateArg === '-h') {
    printList();
    process.exit(0);
  }

  if (!recipient || !recipient.includes('@')) {
    console.error('❌ A valid recipient email is required as the second argument.');
    printList();
    process.exit(1);
  }

  const templatesToSend = templateArg === 'all'
    ? TEMPLATE_NAMES
    : [templateArg];

  for (const name of templatesToSend) {
    if (!TEMPLATES[name]) {
      console.error(`❌ Unknown template: "${name}"`);
      printList();
      process.exit(1);
    }
  }

  console.log(`\n🚀 Sending ${templatesToSend.length} email(s) to: ${recipient}`);
  console.log(`   SES_FROM_EMAIL: "${process.env.SES_FROM_EMAIL || '(not set)'}"`);
  console.log(`   AWS Region: "${process.env.AWS_REGION || 'ap-south-1'}"\n`);

  let sent = 0;
  let simulated = 0;
  let failed = 0;

  for (const name of templatesToSend) {
    const { subject, html, text } = TEMPLATES[name]();
    const result = await sendEmail({ to: recipient, subject, html, text });

    if (result.sent) {
      console.log(`  ✅ [SENT]      ${name} — "${subject}"`);
      sent++;
    } else if (result.simulated) {
      console.log(`  📝 [SIMULATED] ${name} — "${subject}"`);
      simulated++;
    } else {
      console.log(`  ❌ [FAILED]    ${name} — ${result.error || 'unknown error'}`);
      failed++;
    }

    // Small delay between emails to avoid SES throttling
    if (templatesToSend.length > 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n📊 Summary: ${sent} sent, ${simulated} simulated, ${failed} failed\n`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
