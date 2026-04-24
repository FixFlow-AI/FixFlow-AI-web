import { useCallback } from 'react'
import { API_BASE_URL } from '@/config/api'
import { extractPartialSections } from '@/lib/streaming'
import useProposalStore from '@/stores/proposalStore'

export function useStreamingProposal() {
  const parsedSections = useProposalStore((state) => state.parsedSections)
  const isGenerating = useProposalStore((state) => state.isGenerating)
  const error = useProposalStore((state) => state.error)
  const proposalId = useProposalStore((state) => state.generatedProposalId)
  const startStream = useProposalStore((state) => state.startStream)
  const appendStreamBuffer = useProposalStore((state) => state.appendStreamBuffer)
  const setParsedSections = useProposalStore((state) => state.setParsedSections)
  const finishStream = useProposalStore((state) => state.finishStream)
  const setStreamError = useProposalStore((state) => state.setStreamError)
  const resetStream = useProposalStore((state) => state.resetStream)

  const generate = useCallback(
    async (briefText, fileKey = null, existingProposalId = null, briefScore = null) => {
      startStream()

      const accessToken = localStorage.getItem('accessToken')
      let rawBuffer = ''
      let eventBuffer = ''
      let reader = null

      try {
        const response = await fetch(`${API_BASE_URL}/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            briefText,
            fileKey,
            proposalId: existingProposalId,
            briefScore,
          }),
        })

        if (!response.ok) {
          let message = 'Unable to start proposal generation.'

          try {
            const payload = await response.json()
            message = payload.error || message
          } catch {
            // Ignore non-JSON error bodies.
          }

          throw new Error(message)
        }

        reader = response.body?.getReader()
        if (!reader) {
          throw new Error('Streaming is not available in this browser session.')
        }

        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          eventBuffer += decoder.decode(value, { stream: true })
          let boundaryIndex = eventBuffer.indexOf('\n\n')

          while (boundaryIndex !== -1) {
            const rawEvent = eventBuffer.slice(0, boundaryIndex)
            eventBuffer = eventBuffer.slice(boundaryIndex + 2)
            boundaryIndex = eventBuffer.indexOf('\n\n')

            if (!rawEvent.trim() || rawEvent.startsWith(':')) {
              continue
            }

            const payloadText = rawEvent
              .split('\n')
              .filter((line) => line.startsWith('data: '))
              .map((line) => line.replace('data: ', ''))
              .join('\n')

            if (!payloadText) continue

            const payload = JSON.parse(payloadText)

            if (payload.type === 'chunk') {
              rawBuffer += payload.content
              appendStreamBuffer(payload.content)
              setParsedSections(extractPartialSections(rawBuffer))
            } else if (payload.type === 'complete') {
              finishStream(payload.proposalId)
            } else if (payload.type === 'error') {
              throw new Error(payload.message || 'Proposal generation failed.')
            }
          }
        }
      } catch (streamError) {
        setStreamError(streamError.message || 'Proposal generation failed.')
      } finally {
        reader?.releaseLock?.()
      }
    },
    [appendStreamBuffer, finishStream, setParsedSections, setStreamError, startStream]
  )

  return {
    generate,
    parsedSections,
    isGenerating,
    error,
    proposalId,
    resetStream,
  }
}
