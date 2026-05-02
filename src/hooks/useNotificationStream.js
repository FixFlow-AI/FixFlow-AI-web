import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { API_BASE_URL } from '@/config/api'

function buildStreamUrl(accessToken) {
  const base = String(API_BASE_URL || '').replace(/\/$/, '')
  const token = encodeURIComponent(accessToken)
  return `${base}/notifications/stream?token=${token}`
}

export function useNotificationStream() {
  const queryClient = useQueryClient()
  const sourceRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectAttemptRef = useRef(0)

  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken')
    if (!accessToken) {
      return undefined
    }

    let closed = false

    const connect = () => {
      if (closed) return

      try {
        const source = new EventSource(buildStreamUrl(accessToken))
        sourceRef.current = source

        source.addEventListener('connected', () => {
          reconnectAttemptRef.current = 0
        })

        source.addEventListener('notification', (raw) => {
          try {
            const payload = JSON.parse(raw?.data || '{}')

            queryClient.invalidateQueries({ queryKey: ['notifications'] })

            if (payload?.kind === 'rate_limit') {
              if (payload.notificationType === 'rate_limit_exceeded') {
                toast.error(payload.title || 'Quota reached. Upgrade to continue.')
              } else if (payload.notificationType === 'rate_limit_restored') {
                toast.success(payload.title || 'Service restored. You can continue.')
              } else if (payload.notificationType === 'rate_limit_near') {
                toast(payload.title || 'Quota running low')
              }
            }
          } catch {
            // ignore malformed events
          }
        })

        source.onerror = () => {
          try {
            source.close()
          } catch {
            // ignore
          }

          const attempt = reconnectAttemptRef.current + 1
          reconnectAttemptRef.current = attempt
          const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(5, attempt)))

          reconnectTimerRef.current = setTimeout(connect, delay)
        }
      } catch {
        reconnectTimerRef.current = setTimeout(connect, 5000)
      }
    }

    connect()

    return () => {
      closed = true
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      try {
        sourceRef.current?.close?.()
      } catch {
        // ignore
      }
    }
  }, [queryClient])
}

