import { useState, useCallback, useRef } from 'react'

const MUTATE_VERBS = [
  'add', 'remove', 'reduce', 'increase', 'change', 'rewrite',
  'update', 'cut', 'compress', 'replace', 'rebuild', 'make it',
  'modify', 'delete', 'insert', 'swap', 'merge', 'split',
  'shorten', 'extend', 'expand', 'simplify', 'restructure',
]

const QUESTION_WORDS = [
  'why', 'how', 'what', 'explain', 'tell me', 'describe',
  'what if', 'can you', 'could you', 'is there', 'are there',
  'when', 'where', 'which', 'who',
]

const SECTION_KEYWORDS = {
  timeline: ['timeline', 'phase', 'week', 'schedule', 'deadline', 'duration', 'sprint'],
  features: ['feature', 'requirement', 'functionality', 'scope', 'capability'],
  risks: ['risk', 'concern', 'mitigation', 'issue', 'threat'],
  effort: ['effort', 'estimate', 'hours', 'budget', 'cost', 'resource'],
  summary: ['summary', 'introduction', 'overview', 'executive', 'description'],
  market: ['market', 'trend', 'competitor', 'industry'],
  impact: ['impact', 'business', 'value', 'roi', 'benefit'],
}

function classifyText(text) {
  const lower = text.toLowerCase().trim()

  if (!lower) {
    return { intent: 'question', targetSection: null, intentLabel: '' }
  }

  const hasMutateVerb = MUTATE_VERBS.some((verb) => {
    const regex = new RegExp(`\\b${verb.replace(/\s+/g, '\\s+')}\\b`, 'i')
    return regex.test(lower)
  })

  const hasQuestionWord = QUESTION_WORDS.some((word) => {
    const regex = new RegExp(`\\b${word.replace(/\s+/g, '\\s+')}\\b`, 'i')
    return regex.test(lower)
  })

  const intent = hasMutateVerb ? 'mutate' : 'question'

  // Extract target section
  let targetSection = null
  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      targetSection = section
      break
    }
  }

  // Build user-facing label
  let intentLabel = ''
  if (intent === 'mutate') {
    intentLabel = targetSection
      ? `Mutation detected — will update: ${targetSection.charAt(0).toUpperCase() + targetSection.slice(1)}`
      : 'Mutation detected'
  } else {
    intentLabel = hasQuestionWord ? 'Question detected' : ''
  }

  return { intent, targetSection, intentLabel }
}

/**
 * Client-side intent classifier hook.
 * Runs a debounced keyword heuristic as the user types.
 */
export function useIntentClassifier() {
  const [classification, setClassification] = useState({
    intent: 'question',
    targetSection: null,
    intentLabel: '',
  })
  const debounceRef = useRef(null)

  const classify = useCallback((text) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      setClassification(classifyText(text))
    }, 300)
  }, [])

  const classifyImmediate = useCallback((text) => {
    return classifyText(text)
  }, [])

  return {
    ...classification,
    classify,
    classifyImmediate,
  }
}
