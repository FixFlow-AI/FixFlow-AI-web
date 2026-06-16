import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api, { API_BASE_URL } from '@/config/api'
import { getAccessToken } from '@/lib/authToken'

const freelancerKeys = {
  all: ['freelancer'],
  flowboard: ['freelancer', 'flowboard'],
  niches: ['freelancer', 'niches'],
  leads: ['freelancer', 'leads'],
  outreach: ['freelancer', 'outreach'],
  escrows: ['freelancer', 'escrows'],
  profile: ['freelancer', 'profile'],
  credentials: ['freelancer', 'credentials'],
  searchProviders: ['freelancer', 'searchProviders'],
  llmProviders: ['freelancer', 'llmProviders'],
}

function unwrap(key) {
  return (response) => response.data[key] ?? response.data
}

export function useFreelancerFlowboard() {
  return useQuery({
    queryKey: freelancerKeys.flowboard,
    queryFn: () => api.get('/freelancer/flowboard').then((response) => response.data),
  })
}

export function useFreelancerNiches() {
  return useQuery({
    queryKey: freelancerKeys.niches,
    queryFn: () => api.get('/freelancer/niches').then(unwrap('niches')),
  })
}

export function useFreelancerLeads() {
  return useQuery({
    queryKey: freelancerKeys.leads,
    queryFn: () => api.get('/freelancer/leads').then(unwrap('leads')),
  })
}

export function useFreelancerOutreach() {
  return useQuery({
    queryKey: freelancerKeys.outreach,
    queryFn: () => api.get('/freelancer/outreach').then(unwrap('leads')),
  })
}

export function useFreelancerEscrows() {
  return useQuery({
    queryKey: freelancerKeys.escrows,
    queryFn: () => api.get('/freelancer/escrows').then((response) => response.data),
  })
}

export function useFreelancerProfile() {
  return useQuery({
    queryKey: freelancerKeys.profile,
    queryFn: () => api.get('/freelancer/profiles').then(unwrap('profile')),
  })
}

export function useFreelancerCredentials() {
  return useQuery({
    queryKey: freelancerKeys.credentials,
    queryFn: () => api.get('/freelancer/credentials').then(unwrap('credentials')),
  })
}

export function useFreelancerSearchProviders() {
  return useQuery({
    queryKey: freelancerKeys.searchProviders,
    queryFn: () => api.get('/freelancer/search/providers').then(unwrap('providers')),
  })
}

export function useFreelancerLlmProviders() {
  return useQuery({
    queryKey: freelancerKeys.llmProviders,
    queryFn: () => api.get('/freelancer/llm/providers').then(unwrap('providers')),
  })
}

export function useFreelancerMutations() {
  const queryClient = useQueryClient()
  const invalidateAll = () => queryClient.invalidateQueries({ queryKey: freelancerKeys.all })

  const acceptNiche = useMutation({
    mutationFn: ({ id, accepted }) => api.patch(`/freelancer/niches/${id}`, { accepted }).then(unwrap('niche')),
    onSuccess: invalidateAll,
  })

  const updateLead = useMutation({
    mutationFn: ({ id, updates }) => api.patch(`/freelancer/leads/${id}`, updates).then(unwrap('lead')),
    onSuccess: invalidateAll,
  })

  const draftLead = useMutation({
    mutationFn: (id) => api.post(`/freelancer/leads/${id}/draft`).then(unwrap('draftMessage')),
    onSuccess: invalidateAll,
  })

  const sendLead = useMutation({
    mutationFn: (id) => api.post(`/freelancer/leads/${id}/send`).then((response) => response.data),
    onSuccess: invalidateAll,
  })

  const discoverLeads = useMutation({
    mutationFn: (payload = {}) => api.post('/freelancer/leads/discover', payload).then((response) => response.data),
    onSuccess: invalidateAll,
  })

  const matchProject = useMutation({
    mutationFn: (payload) => api.post('/freelancer/projects/match', payload).then(unwrap('match')),
  })

  const generateProfiles = useMutation({
    mutationFn: () => api.post('/freelancer/profiles/generate').then(unwrap('profiles')),
    onSuccess: invalidateAll,
  })

  const updateAgents = useMutation({
    mutationFn: (agentConfig) => api.patch('/freelancer/settings/agents', agentConfig).then(unwrap('agentConfig')),
    onSuccess: invalidateAll,
  })

  const mintCredential = useMutation({
    mutationFn: (skill) => api.post('/freelancer/credentials/mint', { skill }).then(unwrap('credential')),
    onSuccess: invalidateAll,
  })

  const releaseMilestone = useMutation({
    mutationFn: ({ escrowId, milestoneIndex }) =>
      api.post(`/freelancer/escrows/${escrowId}/release/${milestoneIndex}`).then((response) => response.data),
    onSuccess: invalidateAll,
  })

  const disputeEscrow = useMutation({
    mutationFn: (escrowId) => api.post(`/freelancer/escrows/${escrowId}/dispute`).then((response) => response.data),
    onSuccess: invalidateAll,
  })

  return {
    acceptNiche,
    discoverLeads,
    disputeEscrow,
    draftLead,
    generateProfiles,
    mintCredential,
    releaseMilestone,
    sendLead,
    matchProject,
    updateAgents,
    updateLead,
  }
}

export async function streamNicheAnalysis({ onStart, onNiche, onComplete, onError } = {}) {
  const accessToken = getAccessToken()
  const response = await fetch(`${API_BASE_URL}/freelancer/niches/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ mode: 'demo-ready' }),
  })

  if (!response.ok) {
    throw new Error('Unable to start niche analysis.')
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('Streaming is unavailable in this browser.')
  }

  const decoder = new TextDecoder()
  let eventBuffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      eventBuffer += decoder.decode(value, { stream: true })
      let boundaryIndex = eventBuffer.indexOf('\n\n')

      while (boundaryIndex !== -1) {
        const rawEvent = eventBuffer.slice(0, boundaryIndex)
        eventBuffer = eventBuffer.slice(boundaryIndex + 2)
        boundaryIndex = eventBuffer.indexOf('\n\n')

        if (!rawEvent.trim() || rawEvent.startsWith(':')) continue

        const payloadText = rawEvent
          .split('\n')
          .filter((line) => line.startsWith('data: '))
          .map((line) => line.replace('data: ', ''))
          .join('\n')

        if (!payloadText) continue

        const payload = JSON.parse(payloadText)

        if (payload.type === 'started') onStart?.()
        if (payload.type === 'niche') onNiche?.(payload.niche)
        if (payload.type === 'complete') onComplete?.()
        if (payload.type === 'error') throw new Error(payload.message || 'Niche analysis failed.')
      }
    }
  } catch (error) {
    onError?.(error)
    throw error
  } finally {
    reader.releaseLock?.()
  }
}

export function countWords(text = '') {
  return String(text).trim().split(/\s+/).filter(Boolean).length
}
