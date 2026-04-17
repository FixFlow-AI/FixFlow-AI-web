import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export function getConfidenceColor(confidence: number): string {
  if (confidence >= 80) return 'var(--confidence-high)'
  if (confidence >= 50) return 'var(--confidence-medium)'
  return 'var(--confidence-low)'
}

export function getConfidenceLabel(confidence: number): 'High' | 'Medium' | 'Low' {
  if (confidence >= 80) return 'High'
  if (confidence >= 50) return 'Medium'
  return 'Low'
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
