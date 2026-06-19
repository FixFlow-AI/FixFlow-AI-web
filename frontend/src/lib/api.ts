/**
 * FixFlow AI Mock API Client
 * Simulates network delays and returns structured responses matching the backend API contracts.
 */

// Delay simulation helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface FeeBreakdown {
  grossAmount: number;
  platformFee: number;
  paymentGatewayFee: number;
  withholdingTax: number;
  netFreelancerEarnings: number;
  totalClientCheckout: number;
}

export const api = {
  // Simulates starting a proposal generation and streaming chunks
  generateProposal: async (
    brief: string,
    onChunk: (text: string) => void
  ): Promise<any> => {
    const chunks = [
      "Initializing AI Analyst...",
      "Analyzing requirements in brief...",
      "Decomposing deliverables into weekly milestones...",
      "Drafting technical approaches for features...",
      "Mapping project timeline schedules...",
      "Evaluating risk profiles and mitigation steps...",
      "Configuring notification hooks..."
    ];

    for (const chunk of chunks) {
      await delay(400);
      onChunk(chunk);
    }

    return {
      id: `prp-${Date.now()}`,
      title: brief.split('.').slice(0, 1).join('') || 'Custom Project Proposal',
      s3Key: `proposals/prp-${Date.now()}/v1.json`,
      projectSummary: `A comprehensive project setup addressing: ${brief}`,
      status: 'READY' as const,
      dealStatus: 'PENDING' as const,
      versionCount: 1,
      briefScore: { scope: 85, technical: 92, timeline: 88 },
      createdAt: new Date().toISOString(),
      comments: []
    };
  },

  // Simulates calculating earnings breakdown on the frontend (mirroring earningsCalculator.js)
  calculateFees: async (
    grossAmount: number,
    plan: 'FREE' | 'SOLO' | 'PRO' | 'AGENCY',
    countryCode: string = 'IN'
  ): Promise<FeeBreakdown> => {
    await delay(200);

    let rate = 0.10;
    if (plan === 'SOLO') rate = 0.05;
    else if (plan === 'PRO') rate = 0.03;
    else if (plan === 'AGENCY') rate = 0.02;

    const round = (val: number) => Math.round(val * 100) / 100;

    const platformFee = round(grossAmount * rate);
    const paymentGatewayFee = round(grossAmount * 0.02 + 3);
    const withholdingTax = countryCode === 'IN' ? round(grossAmount * 0.01) : 0;
    const netFreelancerEarnings = round(
      Math.max(0, grossAmount - platformFee - paymentGatewayFee - withholdingTax)
    );
    const totalClientCheckout = round(grossAmount * 1.015);

    return {
      grossAmount,
      platformFee,
      paymentGatewayFee,
      withholdingTax,
      netFreelancerEarnings,
      totalClientCheckout
    };
  }
};
export default api;
