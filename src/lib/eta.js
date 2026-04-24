export function formatSecondsLabel(seconds) {
  const value = Math.max(0, Math.round(Number(seconds) || 0))

  if (value < 60) {
    return `${value}s`
  }

  const minutes = Math.floor(value / 60)
  const remainingSeconds = value % 60

  if (remainingSeconds === 0) {
    return `${minutes}m`
  }

  return `${minutes}m ${remainingSeconds}s`
}

export function formatEtaRange(eta) {
  if (!eta) {
    return ''
  }

  return `${formatSecondsLabel(eta.minSeconds)}-${formatSecondsLabel(eta.maxSeconds)}`
}

export function describeEtaBasis(eta) {
  if (!eta) {
    return ''
  }

  if (eta.basis === 'history') {
    return `Based on ${eta.sampleSize} recent runs`
  }

  if (eta.basis === 'blended') {
    return `Blended from ${eta.sampleSize} recent runs and live heuristics`
  }

  return 'Estimated from brief and model heuristics'
}
