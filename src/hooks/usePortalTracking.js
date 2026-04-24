import { useCallback, useEffect, useRef } from 'react'
import { API_BASE_URL } from '@/config/api'

function toPayload(pendingMap) {
  return Object.entries(pendingMap).map(([section, value]) => ({
    section,
    dwellMs: Math.round(value.dwellMs || 0),
    views: value.views || 0,
  }))
}

export function usePortalTracking(shareToken, enabled = true) {
  const observerRef = useRef(null)
  const sectionNodesRef = useRef(new Map())
  const activeSectionsRef = useRef(new Map())
  const pendingRef = useRef({})

  const flushPending = useCallback(async () => {
    if (!enabled || !shareToken) return

    const now = Date.now()
    activeSectionsRef.current.forEach((startedAt, section) => {
      const pending = pendingRef.current[section] || { dwellMs: 0, views: 0 }
      pending.dwellMs += now - startedAt
      pendingRef.current[section] = pending
      activeSectionsRef.current.set(section, now)
    })

    const payload = toPayload(pendingRef.current)
    if (!payload.length) return

    pendingRef.current = {}

    try {
      await fetch(`${API_BASE_URL}/portal/${shareToken}/event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: payload }),
        keepalive: true,
      })
    } catch {
      // Ignore public tracking failures.
    }
  }, [enabled, shareToken])

  useEffect(() => {
    if (!enabled || !shareToken) {
      return undefined
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const section = entry.target.getAttribute('data-portal-section')
          if (!section) return

          if (entry.isIntersecting) {
            if (!activeSectionsRef.current.has(section)) {
              activeSectionsRef.current.set(section, Date.now())
            }
            return
          }

          if (!activeSectionsRef.current.has(section)) return
          const startedAt = activeSectionsRef.current.get(section)
          const pending = pendingRef.current[section] || { dwellMs: 0, views: 0 }
          pending.dwellMs += Date.now() - startedAt
          pending.views += 1
          pendingRef.current[section] = pending
          activeSectionsRef.current.delete(section)
        })
      },
      { threshold: 0.45 }
    )

    const interval = window.setInterval(() => {
      flushPending()
    }, 10000)

    const handlePageHide = () => {
      flushPending()
    }

    window.addEventListener('pagehide', handlePageHide)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('pagehide', handlePageHide)
      observerRef.current?.disconnect()
    }
  }, [enabled, flushPending, shareToken])

  const registerSectionRef = useCallback((section) => {
    return (node) => {
      const previousNode = sectionNodesRef.current.get(section)
      if (previousNode && observerRef.current) {
        observerRef.current.unobserve(previousNode)
      }

      if (!node || !observerRef.current) {
        sectionNodesRef.current.delete(section)
        return
      }

      node.setAttribute('data-portal-section', section)
      sectionNodesRef.current.set(section, node)
      observerRef.current.observe(node)
    }
  }, [])

  return {
    registerSectionRef,
    flushPending,
  }
}
