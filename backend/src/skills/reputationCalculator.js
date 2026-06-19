/**
 * Reputation Calculator Utility
 * Calculates freelancer reputation metrics (on-time delivery, revision efficiency, disputes, repeat clients)
 * and formats the Soulbound Token (SBT) metadata JSON schema for Polygon minting.
 * 
 * Keep files clean, modular, and under 300 lines.
 */

/**
 * Rounds a number to 2 decimal places.
 * @param {number} val
 * @returns {number}
 */
function roundToTwo(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Computes performance metrics based on freelancer escrow milestone history.
 * 
 * Each history record should look like:
 * {
 *   milestoneId: string,
 *   clientId: string,
 *   dueDate: string | Date, // ISO date or Date object
 *   completedDate: string | Date, // ISO date or Date object
 *   revisionCount: number,
 *   hasDispute: boolean,
 *   state: string
 * }
 * 
 * @param {Array<Object>} escrowHistory
 * @returns {{
 *   onTimeDeliveryRate: number,
 *   revisionEfficiencyScore: number,
 *   disputeFreeRate: number,
 *   repeatClientRate: number,
 *   compositeReputationScore: number,
 *   totalMilestones: number
 * }}
 */
export function calculateReputationMetrics(escrowHistory) {
  const totalMilestones = Array.isArray(escrowHistory) ? escrowHistory.length : 0;

  if (totalMilestones === 0) {
    return {
      onTimeDeliveryRate: 100,
      revisionEfficiencyScore: 100,
      disputeFreeRate: 100,
      repeatClientRate: 0,
      compositeReputationScore: 90, // Neutral starting score
      totalMilestones: 0
    };
  }

  // 1. Calculate On-Time Delivery Rate
  const milestonesWithDue = escrowHistory.filter(m => m.dueDate && m.completedDate);
  let onTimeDeliveryRate = 100;
  if (milestonesWithDue.length > 0) {
    const onTimeCount = milestonesWithDue.filter(m => new Date(m.completedDate) <= new Date(m.dueDate)).length;
    onTimeDeliveryRate = roundToTwo((onTimeCount / milestonesWithDue.length) * 100);
  }

  // 2. Calculate Revision Efficiency Score
  const totalRevisions = escrowHistory.reduce((sum, m) => sum + (m.revisionCount || 0), 0);
  const avgRevisions = totalRevisions / totalMilestones;
  // Deduct 25 points per average revision, floor at 0
  const revisionEfficiencyScore = roundToTwo(Math.max(0, 100 - (avgRevisions * 25)));

  // 3. Calculate Dispute-Free Rate
  const disputeCount = escrowHistory.filter(m => m.hasDispute || m.state === 'Dispute').length;
  const disputeFreeRate = roundToTwo((1 - (disputeCount / totalMilestones)) * 100);

  // 4. Calculate Repeat Client Rate (ratio of repeat contract occurrences)
  const uniqueClients = new Set(escrowHistory.map(m => m.clientId).filter(Boolean)).size;
  const repeatClientRate = totalMilestones > 0 ? roundToTwo((1 - (uniqueClients / totalMilestones)) * 100) : 0;

  // 5. Composite Reputation Score (Weighted: 40% On-Time, 20% Revision, 30% Dispute-Free, 10% Repeat Client)
  const compositeReputationScore = roundToTwo(
    (onTimeDeliveryRate * 0.4) +
    (revisionEfficiencyScore * 0.2) +
    (disputeFreeRate * 0.3) +
    (repeatClientRate * 0.1)
  );

  return {
    onTimeDeliveryRate,
    revisionEfficiencyScore,
    disputeFreeRate,
    repeatClientRate,
    compositeReputationScore,
    totalMilestones
  };
}

/**
 * Builds standard ERC-721 metadata JSON for a Soulbound Token (SBT).
 * Primarily used for Polygon minting to display on platforms like OpenSea.
 * 
 * @param {{
 *   onTimeDeliveryRate: number,
 *   revisionEfficiencyScore: number,
 *   disputeFreeRate: number,
 *   repeatClientRate: number,
 *   compositeReputationScore: number,
 *   totalMilestones: number
 * }} metrics
 * @param {string} freelancerDid - Decentralized Identifier of the freelancer
 * @returns {Object} Metadata object
 */
export function buildSBTMetadata(metrics, freelancerDid) {
  if (!freelancerDid) {
    throw new Error('freelancerDid is required to build reputation SBT metadata.');
  }

  return {
    name: `FixFlow AI Reputation Badge - ${freelancerDid.substring(0, 12)}...`,
    description: `A Soulbound Token (SBT) validating professional performance and reputation on FixFlow AI. This badge is non-transferable and represents verified milestone delivery metrics.`,
    image: `ipfs://QmZP5vS8zR41K4VshLz4V3vS7g9sP3jLqB1oWn9yF4zR1a`, // Default generic verified badge SVG on IPFS
    external_url: `https://fixflow.ai/profile/${encodeURIComponent(freelancerDid)}`,
    attributes: [
      {
        trait_type: "Composite Reputation Score",
        value: metrics.compositeReputationScore,
        max_value: 100
      },
      {
        trait_type: "On-Time Delivery Rate",
        value: metrics.onTimeDeliveryRate,
        display_type: "boost_percentage"
      },
      {
        trait_type: "Revision Efficiency Score",
        value: metrics.revisionEfficiencyScore,
        max_value: 100
      },
      {
        trait_type: "Dispute-Free Rate",
        value: metrics.disputeFreeRate,
        display_type: "boost_percentage"
      },
      {
        trait_type: "Repeat Client Rate",
        value: metrics.repeatClientRate,
        display_type: "boost_percentage"
      },
      {
        trait_type: "Total Verified Milestones",
        value: metrics.totalMilestones,
        display_type: "number"
      },
      {
        trait_type: "Soulbound Owner DID",
        value: freelancerDid
      }
    ]
  };
}
