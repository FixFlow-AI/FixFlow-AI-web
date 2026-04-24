import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react'
import api from '@/config/api'

export function useBriefScore(briefText, fileKey = null) {
  const deferredBrief = useDeferredValue(briefText)
  const requestIdRef = useRef(0)
  const [briefScore, setBriefScore] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const wordCount = deferredBrief.trim().split(/\s+/).filter(Boolean).length
  const canAnalyze = Boolean(fileKey) || wordCount >= 50

  useEffect(() => {
    if (!deferredBrief.trim() && !fileKey) {
      setBriefScore(null)
      setError('')
      setIsLoading(false)
      return
    }

    if (!canAnalyze) {
      setBriefScore(null)
      setError('')
      setIsLoading(false)
      return
    }

    const currentRequestId = ++requestIdRef.current
    setIsLoading(true)
    setError('')

    const timeout = window.setTimeout(async () => {
      try {
        const { data } = await api.post('/brief/score', {
          briefText: deferredBrief,
          fileKey,
        })

        if (currentRequestId !== requestIdRef.current) return

        startTransition(() => {
          setBriefScore(data)
          setIsLoading(false)
        })
      } catch (scoreError) {
        if (currentRequestId !== requestIdRef.current) return

        setBriefScore(null)
        setIsLoading(false)
        setError(scoreError.response?.data?.error || 'Brief scoring failed.')
      }
    }, 1200)

    return () => {
      window.clearTimeout(timeout)
    }
  }, [canAnalyze, deferredBrief, fileKey])

  return {
    briefScore,
    isLoading,
    error,
    canAnalyze,
    wordCount,
  }
}
