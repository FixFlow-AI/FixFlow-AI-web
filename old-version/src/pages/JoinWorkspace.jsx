import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api from '@/config/api'
import { Button } from '@/components/ui/Button'
import useAuthStore from '@/stores/authStore'

export default function JoinWorkspace() {
  const { token } = useParams()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const setCurrentWorkspace = useAuthStore((state) => state.setCurrentWorkspace)
  const updateUser = useAuthStore((state) => state.updateUser)

  const previewQuery = useQuery({
    queryKey: ['workspace-invite', token],
    queryFn: () => api.get(`/workspaces/join/${token}`).then((response) => response.data),
    enabled: Boolean(token),
  })

  const message = useMemo(() => {
    if (!previewQuery.data) {
      return 'Loading workspace invite...'
    }

    return `${previewQuery.data.inviterName} invited you to join ${previewQuery.data.workspaceName} as a ${previewQuery.data.role}.`
  }, [previewQuery.data])

  const handleAccept = async () => {
    try {
      const { data } = await api.post(`/workspaces/join/${token}`)
      setCurrentWorkspace(data.currentWorkspace || data.workspace || null)
      updateUser({ defaultEntryMode: 'team' })
      toast.success('Workspace joined.')
      navigate('/workspace')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to join the workspace.')
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-2xl glass-card rounded-[32px] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.24em] text-primary">Workspace Invite</p>
        <h1 className="mt-3 text-3xl font-bold">Join the team room</h1>
        <p className="mt-4 text-sm text-muted-foreground">{message}</p>

        {isAuthenticated ? (
          <Button className="mt-6" onClick={handleAccept}>
            Accept Invitation
          </Button>
        ) : (
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to={`/login?role=client`}>
              <Button>Sign In</Button>
            </Link>
            <Link to={`/register?role=client`}>
              <Button variant="outline">Create Account</Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
