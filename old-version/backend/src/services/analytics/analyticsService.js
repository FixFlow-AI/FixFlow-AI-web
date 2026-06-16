const Proposal = require('../../models/Proposal');
const {
  calculateProposalConfidence,
  getProposalJSONForRecord,
} = require('../proposal/proposalAccess');

function average(numbers) {
  if (!numbers.length) {
    return 0;
  }

  return Math.round((numbers.reduce((sum, value) => sum + value, 0) / numbers.length) * 10) / 10;
}

function normalizeDealStatus(proposal) {
  return proposal.dealStatus || 'pending';
}

async function getAnalytics(userId) {
  const proposals = await Proposal.find({ userId }).sort({ createdAt: -1 }).lean();

  const statusBreakdown = {
    pending: 0,
    negotiating: 0,
    won: 0,
    lost: 0,
  };

  proposals.forEach((proposal) => {
    statusBreakdown[normalizeDealStatus(proposal)] += 1;
  });

  const proposalDetails = await Promise.all(
    proposals.map(async (proposal) => {
      try {
        const data = await getProposalJSONForRecord(proposal);
        return {
          proposal,
          confidenceScore: calculateProposalConfidence(data),
          features: Array.isArray(data.features) ? data.features : [],
        };
      } catch {
        return {
          proposal,
          confidenceScore: 0,
          features: [],
        };
      }
    })
  );

  const won = proposalDetails.filter(({ proposal }) => normalizeDealStatus(proposal) === 'won');
  const lost = proposalDetails.filter(({ proposal }) => normalizeDealStatus(proposal) === 'lost');
  const closedCount = won.length + lost.length;

  const topWinningFeatures = Object.entries(
    won.reduce((accumulator, item) => {
      item.features.forEach((feature) => {
        const key = feature.title || 'Untitled feature';
        accumulator[key] = (accumulator[key] || 0) + 1;
      });
      return accumulator;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([title, count]) => ({ title, count }));

  const timeToCloseDays = average(
    proposalDetails
      .filter(({ proposal }) => ['won', 'lost'].includes(normalizeDealStatus(proposal)) && proposal.dealStatusUpdatedAt)
      .map(({ proposal }) => {
        const startedAt = new Date(proposal.createdAt).getTime();
        const endedAt = new Date(proposal.dealStatusUpdatedAt).getTime();
        return (endedAt - startedAt) / (24 * 60 * 60 * 1000);
      })
  );

  return {
    totalProposals: proposals.length,
    statusBreakdown,
    winRate: closedCount ? Math.round((won.length / closedCount) * 1000) / 10 : 0,
    confidenceComparison: {
      won: average(won.map((item) => item.confidenceScore)),
      lost: average(lost.map((item) => item.confidenceScore)),
    },
    briefScoreComparison: {
      won: average(won.map(({ proposal }) => Number(proposal.briefScore?.overallScore || 0)).filter(Boolean)),
      lost: average(lost.map(({ proposal }) => Number(proposal.briefScore?.overallScore || 0)).filter(Boolean)),
    },
    timeToCloseDays,
    topWinningFeatures,
  };
}

module.exports = {
  getAnalytics,
};
