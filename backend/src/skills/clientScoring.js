/**
 * Client Scoring Utility
 * Calculates scope stability, payment speed, dispute rates, and profiles clients with risk labels.
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
 * Maps average approval time in hours to a 0-100 payment speed score.
 * Faster approvals yield a higher score.
 * 
 * @param {number} avgHours 
 * @returns {number}
 */
function calculatePaymentSpeedScore(avgHours) {
  if (avgHours <= 0) return 100;
  
  // Under 24 hours: linear decline from 100 down to 80
  if (avgHours <= 24) {
    return roundToTwo(100 - (avgHours * 0.83)); // 24 hours -> ~80
  }
  
  // From 24 hours up to 168 hours (7 days): linear decline from 80 down to 20
  if (avgHours <= 168) {
    const hoursOver24 = avgHours - 24;
    return roundToTwo(80 - (hoursOver24 * (60 / 144))); // 168 hours -> 20
  }
  
  // Over 168 hours: slow decline to 0
  const hoursOver168 = avgHours - 168;
  return roundToTwo(Math.max(0, 20 - (hoursOver168 * 0.05)));
}

/**
 * Evaluates risk labels for a client based on individual scores and dispute history.
 * 
 * @param {{
 *   scopeStabilityScore: number,
 *   paymentSpeedScore: number,
 *   disputeRate: number,
 *   compositeScore: number,
 *   totalMilestones: number
 * }} scores 
 * @returns {string[]} Risk labels list
 */
export function assignRiskLabels(scores) {
  const labels = [];
  
  if (scores.disputeRate > 0.15) {
    labels.push('HIGH_DISPUTE_RISK');
  }
  
  if (scores.scopeStabilityScore < 60) {
    labels.push('SCOPE_CREEP_RISK');
  }
  
  if (scores.paymentSpeedScore < 55) {
    labels.push('LATE_PAYER_RISK');
  }
  
  // Premium client conditions: Active history, high score, zero disputes
  if (scores.compositeScore >= 85 && scores.disputeRate === 0 && scores.totalMilestones >= 3) {
    labels.push('PREMIUM_CLIENT');
  }
  
  return labels;
}

/**
 * Calculates scores and risk profiles for a client based on historical milestones.
 * 
 * Each record in clientHistory should look like:
 * {
 *   milestoneId: string,
 *   edits: number, // number of revisions/edits requested
 *   hoursToApprove: number, // hours from submission to approval
 *   hasDispute: boolean,
 *   state: string
 * }
 * 
 * @param {Array<Object>} clientHistory 
 * @returns {{
 *   scopeStabilityScore: number,
 *   paymentSpeedScore: number,
 *   disputeRate: number,
 *   compositeScore: number,
 *   riskLabels: string[],
 *   totalMilestones: number
 * }}
 */
export function calculateClientScore(clientHistory) {
  const totalMilestones = Array.isArray(clientHistory) ? clientHistory.length : 0;

  // Default values for client with no history
  if (totalMilestones === 0) {
    const scores = {
      scopeStabilityScore: 100,
      paymentSpeedScore: 80, // Default neutral score
      disputeRate: 0,
      compositeScore: 84, // (100 * 0.3) + (80 * 0.4) + (100 * 0.3)
      totalMilestones: 0
    };
    return {
      ...scores,
      riskLabels: []
    };
  }

  // 1. Calculate Scope Stability
  const totalEdits = clientHistory.reduce((sum, m) => sum + (m.edits || 0), 0);
  const scopeStabilityScore = roundToTwo(
    Math.max(0, 100 - (totalEdits / totalMilestones * 100))
  );

  // 2. Calculate Payment Speed
  const totalHours = clientHistory.reduce((sum, m) => sum + (m.hoursToApprove || 0), 0);
  const avgHours = totalHours / totalMilestones;
  const paymentSpeedScore = calculatePaymentSpeedScore(avgHours);

  // 3. Calculate Dispute Rate
  const disputeCount = clientHistory.filter(m => m.hasDispute || m.state === 'Dispute').length;
  const disputeRate = roundToTwo(disputeCount / totalMilestones);
  const disputeScore = roundToTwo(Math.max(0, 100 - (disputeRate * 100)));

  // 4. Composite Quality Index (Weighted: 30% Stability, 40% Speed, 30% Dispute Free)
  const compositeScore = roundToTwo(
    (scopeStabilityScore * 0.3) + (paymentSpeedScore * 0.4) + (disputeScore * 0.3)
  );

  const scoreData = {
    scopeStabilityScore,
    paymentSpeedScore,
    disputeRate,
    compositeScore,
    totalMilestones
  };

  const riskLabels = assignRiskLabels(scoreData);

  return {
    ...scoreData,
    riskLabels
  };
}
