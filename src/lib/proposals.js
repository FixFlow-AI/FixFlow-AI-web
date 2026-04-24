const EFFORT_COLORS = ['#8b5cf6', '#6366f1', '#22c55e', '#f59e0b', '#ef4444']

function buildId(prefix, index, value = '') {
  const slug = String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return `${prefix}-${index + 1}${slug ? `-${slug}` : ''}`
}

function getRiskColor(severity) {
  if (severity >= 75) return 'var(--confidence-low)'
  if (severity >= 50) return 'var(--confidence-medium)'
  return 'var(--confidence-high)'
}

function estimateWeeks(duration) {
  const numbers = String(duration || '')
    .match(/\d+/g)
    ?.map((value) => Number(value)) || []

  if (!numbers.length) {
    return 0
  }

  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
}

export function calculateOverallConfidence(features = []) {
  if (!features.length) return 0

  const total = features.reduce((sum, feature) => sum + Number(feature.confidence_pct || 0), 0)
  return Math.round(total / features.length)
}

export function calculateEstimatedDuration(timeline = []) {
  const totalWeeks = timeline.reduce((sum, phase) => sum + estimateWeeks(phase.duration), 0)
  if (!totalWeeks) return 'TBD'
  return `${Math.round(totalWeeks)} weeks`
}

export function normalizeProposalRecord(record = {}) {
  const data = record.data || {}
  const features = (data.features || []).map((feature, index) => ({
    ...feature,
    id: feature.id || buildId('feature', index, feature.title),
  }))
  const risks = (data.risks || []).map((risk, index) => ({
    ...risk,
    id: risk.id || buildId('risk', index, risk.label),
    color: risk.color || getRiskColor(Number(risk.severity || 0)),
  }))
  const timeline = (data.timeline || []).map((phase, index) => ({
    ...phase,
    id: phase.id || buildId('phase', index, phase.phase),
  }))
  const effort = (data.effort || []).map((item, index) => ({
    ...item,
    id: item.id || buildId('effort', index, item.label),
    color: item.color || EFFORT_COLORS[index % EFFORT_COLORS.length],
  }))
  const market = (data.market || []).map((item, index) => ({
    ...item,
    id: item.id || buildId('market', index, item.title),
  }))
  const impact = (data.impact || []).map((item, index) => ({
    ...item,
    id: item.id || buildId('impact', index, item.title),
  }))

  return {
    ...record,
    id: record.proposalId || record.id,
    proposalId: record.proposalId || record.id,
    title: record.title || data.project_summary || 'Untitled Proposal',
    project_summary: data.project_summary || record.projectSummary || '',
    dealStatus: record.dealStatus || 'pending',
    dealStatusUpdatedAt: record.dealStatusUpdatedAt || null,
    lossReason: record.lossReason || '',
    briefScore: record.briefScore || null,
    wonOutcome: record.wonOutcome || null,
    lostOutcome: record.lostOutcome || null,
    features,
    risks,
    timeline,
    effort,
    market,
    impact,
    overallConfidence: calculateOverallConfidence(features),
    estimatedDuration: calculateEstimatedDuration(timeline),
  }
}

export function normalizeProposalList(proposals = []) {
  return proposals.map((proposal) => normalizeProposalRecord(proposal))
}

export function summarizeChangedSections(diff = {}) {
  return Object.keys(diff)
    .filter((key) => key !== '_t')
    .map((key) => key.replace(/_/g, ' '))
}
