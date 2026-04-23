import { useState, useCallback, useRef } from 'react'
import { API_BASE_URL } from '@/config/api'

/**
 * useProposalChat Hook
 *
 * Manages all chat state: message history, streaming buffer,
 * SSE connection lifecycle, and section update events.
 */
export function useProposalChat(proposalId) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState(null)
  const [sectionUpdates, setSectionUpdates] = useState([])
  const [currentVersion, setCurrentVersion] = useState(null)
  const readerRef = useRef(null)

  /**
   * Send a chat message and handle the SSE response stream.
   */
  const sendMessage = useCallback(
    async (message, intent = 'question', targetSection = null) => {
      if (!proposalId || !message.trim() || isStreaming) return

      const accessToken = localStorage.getItem('accessToken')
      setError(null)

      // Add user message
      const userMessage = { role: 'user', content: message, timestamp: Date.now() }
      setMessages((prev) => [...prev, userMessage])

      // Create placeholder for AI response
      const aiMessageId = Date.now() + 1
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '',
          timestamp: aiMessageId,
          isStreaming: true,
          intent,
          targetSection,
        },
      ])

      setIsStreaming(true)

      // Build history from existing messages (exclude the current ones we just added)
      const history = messages
        .filter((msg) => !msg.isStreaming)
        .map(({ role, content }) => ({ role, content }))

      let eventBuffer = ''
      let reader = null

      try {
        const response = await fetch(`${API_BASE_URL.replace(/\/api\/?$/, '')}/api/proposal/${proposalId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            message,
            intent,
            targetSection,
            history,
          }),
        })

        if (!response.ok) {
          let errorMessage = 'Chat request failed.'
          try {
            const errorPayload = await response.json()
            errorMessage = errorPayload.error || errorPayload.message || errorMessage
          } catch {
            // ignore
          }
          throw new Error(errorMessage)
        }

        reader = response.body?.getReader()
        readerRef.current = reader

        if (!reader) {
          throw new Error('Streaming is not available.')
        }

        const decoder = new TextDecoder()
        let fullResponse = ''

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

            // Parse SSE event
            let eventType = 'message'
            let dataText = ''

            for (const line of rawEvent.split('\n')) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim()
              } else if (line.startsWith('data: ')) {
                dataText += line.slice(6)
              }
            }

            if (!dataText) continue

            let payload
            try {
              payload = JSON.parse(dataText)
            } catch {
              continue
            }

            // Handle different event types
            switch (eventType) {
              case 'token': {
                const text = payload.text || payload.chunk || ''
                fullResponse += text

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.timestamp === aiMessageId
                      ? { ...msg, content: fullResponse }
                      : msg
                  )
                )
                break
              }

              case 'section_update': {
                const update = {
                  section: payload.section,
                  payload: payload.payload,
                  newVersion: payload.newVersion,
                  summary: payload.summary,
                  timestamp: Date.now(),
                }

                setSectionUpdates((prev) => [...prev, update])
                setCurrentVersion(payload.newVersion)

                // Add a mutation confirmation to the chat
                setMessages((prev) => [
                  ...prev.map((msg) =>
                    msg.timestamp === aiMessageId
                      ? { ...msg, isStreaming: false }
                      : msg
                  ),
                  {
                    role: 'system',
                    type: 'mutation_confirm',
                    content: payload.summary || `${payload.section} updated`,
                    section: payload.section,
                    newVersion: payload.newVersion,
                    timestamp: Date.now(),
                  },
                ])
                break
              }

              case 'done': {
                if (payload.fullResponse) {
                  fullResponse = payload.fullResponse
                }

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.timestamp === aiMessageId
                      ? { ...msg, content: fullResponse, isStreaming: false }
                      : msg
                  )
                )
                break
              }

              case 'error': {
                setError(payload.message || 'An error occurred during chat.')

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.timestamp === aiMessageId
                      ? {
                          ...msg,
                          content: fullResponse || 'An error occurred.',
                          isStreaming: false,
                          isError: true,
                        }
                      : msg
                  )
                )
                break
              }
            }
          }
        }

        // Ensure streaming flag is cleared
        setMessages((prev) =>
          prev.map((msg) =>
            msg.timestamp === aiMessageId
              ? { ...msg, isStreaming: false }
              : msg
          )
        )
      } catch (err) {
        setError(err.message || 'Chat request failed.')

        setMessages((prev) =>
          prev.map((msg) =>
            msg.timestamp === aiMessageId
              ? { ...msg, content: err.message || 'Request failed.', isStreaming: false, isError: true }
              : msg
          )
        )
      } finally {
        reader?.releaseLock?.()
        readerRef.current = null
        setIsStreaming(false)
      }
    },
    [proposalId, messages, isStreaming]
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setSectionUpdates([])
    setError(null)
  }, [])

  const clearSectionUpdate = useCallback((section) => {
    setSectionUpdates((prev) => prev.filter((u) => u.section !== section))
  }, [])

  return {
    messages,
    isStreaming,
    error,
    sectionUpdates,
    currentVersion,
    sendMessage,
    clearMessages,
    clearSectionUpdate,
  }
}
