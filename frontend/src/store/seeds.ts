import { LeadItem, ProposalItem, WorkspaceItem, EscrowItem } from './types.js';

export const INITIAL_LEADS: LeadItem[] = [
  {
    id: 'led-1',
    score: 88,
    source: 'Upwork',
    projectDescription: 'Need an expert developer to construct a high-throughput WebSocket sync server in TypeScript for real-time multiplayer telemetry streams.',
    budget: { amount: 8500, rate: 'fixed', currency: 'USDC' },
    status: 'QUALIFIED',
    matchDetails: {
      skillsMatched: ['TypeScript', 'WebSocket', 'Node.js'],
      skillsMissing: ['Rust', 'Vector Clocks'],
      githubEvidence: ['https://github.com/example/ws-sync-prototype']
    },
    company: {
      name: 'Alpha Stream Inc.',
      size: 45,
      stack: ['TypeScript', 'Next.js', 'PostgreSQL'],
      stabilityScore: 50,
      paymentSpeed: 95
    },
    interviewQuestions: [
      {
        question: "Your GitHub prototype shows extensive WebSocket usage, but how will you handle the missing logical ordering parameter? E.g., implementing Vector Clocks to prevent update conflicts in concurrent workspaces?",
        rationale: "Addresses missing skill parameter: Vector Clocks.",
        expectedKeywords: ["causal ordering", "vector clock map", "logical timestamps", "concurrency"],
        idealAnswerSummary: "Candidate describes incrementing participant components locally and broadcasting vector maps to resolve LWW updates."
      },
      {
        question: "We noted your background is primarily Node.js, but our roadmap targets Rust. How would you approach translating a WebSocket hot-path to a Rust actix-web microservice?",
        rationale: "Addresses missing skill parameter: Rust.",
        expectedKeywords: ["Rust", "Actix-web", "ownership", "tokio", "concurrency"],
        idealAnswerSummary: "Candidate references safety models, thread management, and libraries for low-latency handling."
      }
    ]
  },
  {
    id: 'led-2',
    score: 94,
    source: 'LinkedIn Outpost',
    projectDescription: 'Seeking an Automation Engineer to deploy secure, auditable escrow state machines with automated webhook routing and Polygon SBT credentials.',
    budget: { amount: 12000, rate: 'fixed', currency: 'USDC' },
    status: 'NEW',
    matchDetails: {
      skillsMatched: ['Solidity', 'Prisma', 'PostgreSQL', 'MFA'],
      skillsMissing: [],
      githubEvidence: ['https://github.com/example/secure-fsm-ledger']
    },
    company: {
      name: 'VeriTrust Operations',
      size: 12,
      stack: ['React', 'NestJS', 'Polygon'],
      stabilityScore: 92,
      paymentSpeed: 90
    }
  }
];

export const INITIAL_PROPOSALS: ProposalItem[] = [
  {
    id: 'prp-1',
    title: 'Multiplayer Telemetry WebSocket Server',
    s3Key: 'proposals/prp-1/v1.json',
    projectSummary: 'A stateful, multiplexed WebSocket sync gateway utilizing causal Vector Clocks and Optimistic UI reconciliation to provide sub-10ms state updates.',
    status: 'READY',
    dealStatus: 'PENDING',
    versionCount: 1,
    briefScore: { scope: 85, technical: 90, timeline: 80 },
    createdAt: '2026-06-19T10:00:00Z',
    comments: [
      { id: 'c-1', sender: 'Client (Alex)', text: 'Can we ensure the LWW conflict solver runs server-side rather than only on the frontend?', createdAt: '2026-06-19T14:30:00Z' }
    ]
  }
];

export const INITIAL_WORKSPACES: WorkspaceItem[] = [
  {
    id: 'wsp-1',
    name: 'Alpha Stream Operations',
    plan: 'PRO',
    members: [
      { name: 'Alex Mercer (Client)', role: 'Owner' },
      { name: 'Jane Doe (Freelancer)', role: 'Lead Developer' }
    ],
    suggestedExtensions: {
      extensionReasoning: "The initial telemetry server is complete. Logical follow-up milestones focus on optimization, database indexing for vector timelines, and analytics dashboards.",
      suggestedMilestones: [
        {
          title: "Phase 2: PostgreSQL Indexing & Timeline Archiving",
          description: "Implement timescale partitions and index optimization to archive vectors after 24 hours.",
          estimatedDuration: "5 days",
          complexity: "Medium",
          estimatedBudgetPct: 15
        },
        {
          title: "Phase 2: Live Analytics UI Panel",
          description: "Build a telemetry visualizer chart using Recharts and Framer Motion.",
          estimatedDuration: "7 days",
          complexity: "Low",
          estimatedBudgetPct: 10
        }
      ],
      extensionOfferDraft: "Hi Alex! Now that we have successfully delivered the telemetry sync engine, I propose adding database partitioning and a live visualizer panel to optimize long-term scaling. Let me know if you would like me to lock these milestones!"
    }
  }
];

export const INITIAL_ESCROWS: EscrowItem[] = [
  {
    id: 'esc-1',
    leadId: 'led-1',
    clientDid: 'did:key:z6MkuClient',
    freelancerDid: 'did:key:z6MkuFreelancer',
    buyerAddress: '0xBuyerAddressPolygon',
    sellerAddress: '0xSellerAddressPolygon',
    totalAmount: 8500,
    currency: 'USDC',
    razorpayPaymentId: 'pay_vaccount_alpha123',
    chain: 'Polygon Amoy',
    milestones: [
      {
        id: 'm-1',
        title: 'API Schema & Router Setup',
        percentage: 30,
        amount: 2550,
        approved: true,
        state: 'Funds_Released',
        version: 2,
        lastAuditHash: '8789e86349ebc6afdcf8bd00c4724d7bbaf8ce557afa3816f992428f5f53f214'
      },
      {
        id: 'm-2',
        title: 'WebSocket Multiplexer Implementation',
        percentage: 70,
        amount: 5950,
        approved: false,
        state: 'Active',
        version: 1,
        lastAuditHash: ''
      }
    ],
    auditTrail: [
      {
        index: 1,
        timestamp: '2026-06-19T08:00:00Z',
        milestoneId: 'm-1',
        fromState: 'Draft',
        toState: 'Pending_Deposit',
        triggerUserId: 'u-client',
        triggerUserRole: 'Client',
        metadata: 'Milestone initialized',
        previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
        hash: '5415563503ffe63565dbd8abb132faff4efec9dbdcce4e720cb2a1286caba7fa'
      },
      {
        index: 2,
        timestamp: '2026-06-19T09:00:00Z',
        milestoneId: 'm-1',
        fromState: 'Pending_Deposit',
        toState: 'Active',
        triggerUserId: 'u-system',
        triggerUserRole: 'System',
        metadata: 'Escrow funding confirmed by Razorpay',
        previousHash: '5415563503ffe63565dbd8abb132faff4efec9dbdcce4e720cb2a1286caba7fa',
        hash: 'e7791b2614e88a53870cd3e70221e7c3e87e7a92e6eebb8232fd6587e2fa1351'
      },
      {
        index: 3,
        timestamp: '2026-06-19T18:00:00Z',
        milestoneId: 'm-1',
        fromState: 'Active',
        toState: 'Funds_Released',
        triggerUserId: 'u-client',
        triggerUserRole: 'Client',
        metadata: 'Milestone approved. Payout released. [MFA Verified]',
        previousHash: 'e7791b2614e88a53870cd3e70221e7c3e87e7a92e6eebb8232fd6587e2fa1351',
        hash: '8789e86349ebc6afdcf8bd00c4724d7bbaf8ce557afa3816f992428f5f53f214'
      }
    ]
  }
];
