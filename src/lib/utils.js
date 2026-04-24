import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function formatDate(date) {
  if (!date) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date) {
  if (!date) return 'Unknown'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatRelativeTime(date) {
  if (!date) return 'Not yet'

  const diffMs = new Date(date).getTime() - Date.now()
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  const absSeconds = Math.abs(diffMs) / 1000

  if (absSeconds < 60) {
    return formatter.format(Math.round(diffMs / 1000), 'second')
  }

  if (absSeconds < 3600) {
    return formatter.format(Math.round(diffMs / 60000), 'minute')
  }

  if (absSeconds < 86400) {
    return formatter.format(Math.round(diffMs / 3600000), 'hour')
  }

  return formatter.format(Math.round(diffMs / 86400000), 'day')
}

export function formatDurationMs(durationMs) {
  const safeMs = Math.max(0, Number(durationMs || 0))

  if (safeMs < 1000) {
    return `${safeMs} ms`
  }

  const seconds = safeMs / 1000
  if (seconds < 60) {
    return `${seconds.toFixed(1)} sec`
  }

  const minutes = seconds / 60
  return `${minutes.toFixed(1)} min`
}

export function getConfidenceColor(confidence) {
  if (confidence >= 80) return 'var(--confidence-high)'
  if (confidence >= 50) return 'var(--confidence-medium)'
  return 'var(--confidence-low)'
}

export function getConfidenceLabel(confidence) {
  if (confidence >= 80) return 'High'
  if (confidence >= 50) return 'Medium'
  return 'Low'
}

export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function copyToClipboard(value) {
  await navigator.clipboard.writeText(String(value || ''))
}
