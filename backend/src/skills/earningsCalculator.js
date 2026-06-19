/**
 * Earnings Calculator Utility
 * Performs calculations for tiered platform fees, gateway fees, taxes, and client checkout premiums.
 * 
 * Keep files clean, modular, and under 300 lines.
 */

/**
 * Rounds a number to 2 decimal places to avoid floating point issues.
 * @param {number} value
 * @returns {number}
 */
function roundToTwo(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates the complete earnings breakdown for a milestone payout.
 * 
 * Commission Rates:
 * - FREE: 10%
 * - SOLO: 5%
 * - PRO: 3%
 * - AGENCY: 2%
 * 
 * Payment Gateway:
 * - Razorpay: 2% + ₹3 fixed
 * 
 * Withholding Tax (TDS):
 * - India ('IN'): 1%
 * 
 * Client Checkout Premium:
 * - 1.5% added to client payment
 * 
 * @param {number} grossAmount - The milestone contract value
 * @param {string} platformPlan - The freelancer's platform subscription tier
 * @param {string} taxCountryCode - Two-letter ISO country code
 * @returns {{
 *   grossAmount: number,
 *   platformFee: number,
 *   paymentGatewayFee: number,
 *   withholdingTax: number,
 *   netFreelancerEarnings: number,
 *   totalClientCheckout: number
 * }}
 */
export function calculateEarningsBreakdown(grossAmount, platformPlan = 'FREE', taxCountryCode = '') {
  if (typeof grossAmount !== 'number' || grossAmount < 0) {
    throw new Error('Invalid gross amount. Must be a positive number.');
  }

  // 1. Resolve Platform Commission Rate
  let commissionRate = 0.10; // Default FREE tier
  const plan = (platformPlan || '').trim().toUpperCase();
  switch (plan) {
    case 'FREE':
      commissionRate = 0.10;
      break;
    case 'SOLO':
      commissionRate = 0.05;
      break;
    case 'PRO':
      commissionRate = 0.03;
      break;
    case 'AGENCY':
      commissionRate = 0.02;
      break;
    default:
      commissionRate = 0.10;
  }

  const platformFee = roundToTwo(grossAmount * commissionRate);

  // 2. Razorpay Gateway Fee: 2% + ₹3 fixed
  const paymentGatewayFee = roundToTwo(grossAmount * 0.02 + 3);

  // 3. Tax Withholding Rules (TDS 1% for India)
  const country = (taxCountryCode || '').trim().toUpperCase();
  const withholdingTaxRate = country === 'IN' ? 0.01 : 0.00;
  const withholdingTax = roundToTwo(grossAmount * withholdingTaxRate);

  // 4. Net Freelancer Earnings
  const netFreelancerEarnings = roundToTwo(
    Math.max(0, grossAmount - platformFee - paymentGatewayFee - withholdingTax)
  );

  // 5. Client Checkout Premium (1.5%)
  const clientPremium = roundToTwo(grossAmount * 0.015);
  const totalClientCheckout = roundToTwo(grossAmount + clientPremium);

  return {
    grossAmount: roundToTwo(grossAmount),
    platformFee,
    paymentGatewayFee,
    withholdingTax,
    netFreelancerEarnings,
    totalClientCheckout
  };
}
