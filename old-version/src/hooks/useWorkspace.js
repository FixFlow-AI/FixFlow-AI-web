import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/config/api'
import useAuthStore from '@/stores/authStore'
import useWorkspaceStore from '@/stores/workspaceStore'

export function useWorkspace(enabled = true) {
  const currentWorkspace = useAuthStore((state) => state.currentWorkspace)
  const setCurrentWorkspace = useAuthStore((state) => state.setCurrentWorkspace)
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace)
  const setMembers = useWorkspaceStore((state) => state.setMembers)

  const query = useQuery({
    queryKey: ['current-workspace'],
    queryFn: () => api.get('/workspaces/current').then((response) => response.data),
    enabled,
    retry: 1,
  })

  useEffect(() => {
    if (!query.data) {
      return
    }

    setCurrentWorkspace(query.data.workspace || null)
    setWorkspace(query.data.fullWorkspace || null)
    setMembers(query.data.fullWorkspace?.members || [])
  }, [query.data, setCurrentWorkspace, setMembers, setWorkspace])

  return {
    ...query,
    currentWorkspace: query.data?.workspace || currentWorkspace,
    fullWorkspace: query.data?.fullWorkspace || null,
  }
}
