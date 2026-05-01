import { useQuery } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { MessageSquareText, PlugZap, Send, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import api from '@/config/api'

export default function SlackIntegrationCard({ canManage = false }) {
  const slackQuery = useQuery({
    queryKey: ['slack-status'],
    queryFn: () => api.get('/integrations/slack/status').then((response) => response.data.slack),
    retry: 1,
  })

  const slack = slackQuery.data
  const connected = Boolean(slack?.connected)

  const connectSlack = async () => {
    try {
      const { data } = await api.get('/integrations/slack/install-url')
      window.location.href = data.installUrl
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to start Slack install.')
    }
  }

  const sendTest = async () => {
    try {
      await api.post('/integrations/slack/test')
      toast.success('Slack test sent.')
      slackQuery.refetch()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to send Slack test.')
    }
  }

  const disconnect = async () => {
    try {
      await api.delete('/integrations/slack')
      toast.success('Slack disconnected.')
      slackQuery.refetch()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to disconnect Slack.')
    }
  }

  return (
    <div className="glass-card rounded-[28px] p-6" data-testid="slack-integration-card">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-border bg-background/40 p-3">
              <MessageSquareText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Slack notifications</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Send workspace events to the channel selected during Slack install.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {connected ? (
            <>
              <Button variant="outline" onClick={sendTest} disabled={!canManage}>
                <Send className="h-4 w-4" />
                Send Test
              </Button>
              <Button variant="outline" onClick={disconnect} disabled={!canManage}>
                <Unplug className="h-4 w-4" />
                Disconnect
              </Button>
            </>
          ) : (
            <Button onClick={connectSlack} disabled={!canManage}>
              <PlugZap className="h-4 w-4" />
              Connect Slack
            </Button>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-background/30 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Status</div>
          <div className="mt-2 text-lg font-semibold capitalize">{slack?.status || 'disconnected'}</div>
        </div>
        <div className="rounded-2xl border border-border bg-background/30 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Workspace</div>
          <div className="mt-2 truncate text-lg font-semibold">{slack?.teamName || 'Not connected'}</div>
        </div>
        <div className="rounded-2xl border border-border bg-background/30 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Channel</div>
          <div className="mt-2 truncate text-lg font-semibold">{slack?.channelName || 'Choose during install'}</div>
        </div>
      </div>

      {!canManage ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Your workspace role can view this connection, but cannot manage Slack settings.
        </p>
      ) : null}
    </div>
  )
}
