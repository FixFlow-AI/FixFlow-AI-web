import api from '@/config/api'

export const BILLING_PLANS = [
  {
    slug: 'free',
    name: 'Free',
    price: '$0',
    description: '5 proposals per month with FixFlowAI branding.',
    features: ['5 proposals/month', 'Basic exports', 'Client portal with branding'],
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: '$49',
    description: 'Core agency proposal workflow with team collaboration.',
    features: ['50 proposals/month', 'Agency Brain', 'TriProposal', 'Deal Room', '5 seats'],
  },
  {
    slug: 'agency',
    name: 'Agency',
    price: '$249',
    description: 'Unlimited proposal operations for serious teams.',
    features: ['Unlimited proposals', 'Full white-label controls', 'API-ready plan', 'Unlimited team usage'],
  },
  {
    slug: 'solo',
    name: 'Solo',
    price: '$29',
    description: 'Freelancer OS access for niche, lead, outreach, and escrow workflows.',
    features: ['Freelancer OS', '50 proposals/month', 'Lead pipeline', 'Outreach drafts'],
  },
]

export function getBillingStatus() {
  return api.get('/billing/status').then((response) => response.data)
}

export function createCheckoutSession(plan) {
  return api.post('/billing/checkout-session', { plan }).then((response) => response.data)
}

export function createPortalSession() {
  return api.post('/billing/portal-session').then((response) => response.data)
}
