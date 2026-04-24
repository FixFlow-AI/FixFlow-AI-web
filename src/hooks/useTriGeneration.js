import { startTransition, useCallback, useState } from 'react'
import { API_BASE_URL } from '@/config/api'
import { extractPartialSections } from '@/lib/streaming'

const STRATEGIES = ['lean', 'standard', 'premium']

const initialState = STRATEGIES.reduce((state, strategy) => {
  state[strategy] = {
    parsedSections: {},
    rawBuffer: '',
    proposalId: null,
    isLoading: false,
    error: null,
  }
  return state
}, {})

function parseEventChunk(eventBuffer, onEvent) {
  let nextBuffer = eventBuffer
  let boundaryIndex = nextBuffer.indexOf('\n\n')

  while (boundaryIndex !== -1) {
    const rawEvent = nextBuffer.slice(0, boundaryIndex)
    nextBuffer = nextBuffer.slice(boundaryIndex + 2)
    boundaryIndex = nextBuffer.indexOf('\n\n')

    if (!rawEvent.trim() || rawEvent.startsWith(':')) {
      continue
    }

    const payloadText = rawEvent
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => line.replace('data: ', ''))
      .join('\n')

    if (!payloadText) {
      continue
    }

    onEvent(JSON.parse(payloadText))
  }

  return nextBuffer
}

export function useTriGeneration() {
  const [tripId, setTripId] = useState(null)
  const [strategies, setStrategies] = useState(initialState)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState(null)

  const updateStrategyState = useCallback((strategy, updater) => {
    startTransition(() => {
      setStrategies((current) => ({
        ...current,
        [strategy]: updater(current[strategy]),
      }))
    })
  }, [])

  const generateAll = useCallback(async ({ briefText, fileKey = null, briefScore = null, calibrationContext = '', workspaceId = null, nextTripId }) => {
    const accessToken = localStorage.getItem('accessToken')
    setIsGenerating(true)
    setError(null)
    setTripId(nextTripId)
    setStrategies(initialState)

    const runStrategy = async (strategy) => {
      updateStrategyState(strategy, () => ({
        parsedSections: {},
        rawBuffer: '',
        proposalId: null,
        isLoading: true,
        error: null,
      }))

      let eventBuffer = ''
      let rawBuffer = ''

      const response = await fetch(`${API_BASE_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          briefText,
          fileKey,
          briefScore,
          calibrationContext,
          strategy,
          tripId: nextTripId,
          workspaceId,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error || `Unable to generate the ${strategy} strategy.`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('Streaming is not available in this browser session.')
      }

      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          break
        }

        eventBuffer += decoder.decode(value, { stream: true })
        eventBuffer = parseEventChunk(eventBuffer, (payload) => {
          if (payload.type === 'chunk') {
            rawBuffer += payload.content
            updateStrategyState(strategy, (current) => ({
              ...current,
              rawBuffer,
              parsedSections: extractPartialSections(rawBuffer),
            }))
          }

          if (payload.type === 'complete') {
            updateStrategyState(strategy, (current) => ({
              ...current,
              proposalId: payload.proposalId,
              isLoading: false,
            }))
          }

          if (payload.type === 'error') {
            throw new Error(payload.message || `The ${strategy} strategy failed.`)
          }
        })
      }
    }

    try {
      await Promise.all(STRATEGIES.map((strategy) => runStrategy(strategy)))
    } catch (generationError) {
      setError(generationError.message || 'TriProposal generation failed.')
      setStrategies((current) =>
        Object.fromEntries(
          Object.entries(current).map(([strategy, value]) => [
            strategy,
            { ...value, isLoading: false, error: generationError.message || 'Generation failed.' },
          ])
        )
      )
      throw generationError
    } finally {
      setIsGenerating(false)
    }

    return nextTripId
  }, [updateStrategyState])

  return {
    tripId,
    strategies,
    isGenerating,
    error,
    generateAll,
  }
}
