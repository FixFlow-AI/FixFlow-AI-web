import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/config/api'

export function useNotifications(scope = 'all') {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['notifications', scope],
    queryFn: () => api.get('/notifications', { params: { scope, limit: 30 } }).then((response) => response.data),
    refetchInterval: 30000,
  })

  const markRead = useMutation({
    mutationFn: (id) => api.post(`/notifications/${id}/read`).then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all').then((response) => response.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  return {
    ...query,
    notifications: query.data?.notifications || [],
    unreadCount: query.data?.unreadCount || 0,
    markRead: markRead.mutateAsync,
    markAllRead: markAllRead.mutateAsync,
    isMarkingRead: markRead.isPending,
    isMarkingAllRead: markAllRead.isPending,
  }
}
