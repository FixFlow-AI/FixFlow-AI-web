export const AUTH_ROLES = ['freelancer', 'client', 'developer']

export const ROLE_DETAILS = {
  freelancer: {
    label: 'Freelancer',
    shortLabel: 'Freelancer',
    description: 'Showcase GitHub-backed skills, credibility, and delivery proof to win better work.',
    dashboardPath: '/freelancer',
  },
  client: {
    label: 'Client',
    shortLabel: 'Client',
    description: 'Hire skilled freelancers and developers, manage proposals, and move work forward.',
    dashboardPath: '/dashboard',
  },
  developer: {
    label: 'Developer',
    shortLabel: 'Developer',
    description: 'Collaborate on projects, join teams, and build with a structured delivery workspace.',
    dashboardPath: '/developer',
  },
}

export const ROLE_PLAN_OPTIONS = {
  freelancer: [
    { value: 'free', label: 'Free', detail: 'Start with GitHub-linked profile basics.' },
    { value: 'solo', label: 'Solo', detail: 'Freelancer OS for leads, outreach, and niche positioning.' },
    { value: 'agency', label: 'Agency', detail: 'Advanced delivery and client proof workflows.' },
  ],
  client: [
    { value: 'free', label: 'Free', detail: 'Evaluate proposals and client portal basics.' },
    { value: 'pro', label: 'Pro', detail: 'Deal Room, TriProposal, and collaboration tools.' },
    { value: 'agency', label: 'Agency', detail: 'Unlimited proposal operations for growing teams.' },
  ],
  developer: [
    { value: 'free', label: 'Free', detail: 'Join projects and manage lightweight delivery work.' },
    { value: 'pro', label: 'Pro', detail: 'Collaboration, proposal support, and team workflows.' },
    { value: 'agency', label: 'Agency', detail: 'Unlimited workspace operations for build teams.' },
  ],
}

export const ROLE_PROVIDER_OPTIONS = {
  freelancer: ['github'],
  client: ['email', 'google', 'github'],
  developer: ['email', 'google', 'github'],
}

export const PROVIDER_LABELS = {
  email: 'Email and password',
  google: 'Google',
  github: 'GitHub',
}

export const FREELANCER_GITHUB_ONLY_MESSAGE = 'Freelancer accounts can only be accessed using GitHub login.'

export function normalizeRole(role) {
  return AUTH_ROLES.includes(role) ? role : 'client'
}

export function getRolePlans(role) {
  return ROLE_PLAN_OPTIONS[normalizeRole(role)]
}

export function getRoleProviders(role) {
  return ROLE_PROVIDER_OPTIONS[normalizeRole(role)]
}

export function getDefaultPlanForRole(role) {
  return getRolePlans(role)[0].value
}

export function isPlanAllowedForRole(role, plan) {
  return getRolePlans(role).some((option) => option.value === plan)
}

export function getDashboardPathForRole(role) {
  return ROLE_DETAILS[normalizeRole(role)].dashboardPath
}
