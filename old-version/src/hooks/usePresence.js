import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/config/api'

export function usePresence(proposalId, workspaceId = null, enabled = true) {
  const query = useQuery({
    queryKey: ['proposal-presence', proposalId],
    queryFn: async () => {
      await api.post(`/proposals/${proposalId}/presence`, { workspaceId })
      const { data } = await api.get(`/proposals/${proposalId}/presence`)
      return data.viewers || []
    },
    enabled: Boolean(proposalId && enabled),
    refetchInterval: enabled ? 5000 : false,
    refetchIntervalInBackground: true,
  })

  useEffect(() => {
    if (!proposalId || !enabled) {
      return undefined
    }

    api.post(`/proposals/${proposalId}/presence`, { workspaceId }).catch(() => null)

    return () => {
      // TTL cleanup is handled server-side.
    }
  }, [enabled, proposalId, workspaceId])

  return {
    viewers: query.data || [],
    isLoading: query.isLoading,
  }
}
