import toast from 'react-hot-toast'
import { Bot, WalletCards } from 'lucide-react'
import { FreelancerPageShell, SkeletonPanel, TechnicalPanel } from '@/components/freelancer/FreelancerPrimitives'
import { useFreelancerMutations, useFreelancerProfile } from '@/hooks/useFreelancer'

const agentLabels = [
  { key: 'leadHunter', label: 'Lead Hunter', description: 'Keeps the opportunity radar warm.' },
  { key: 'outreachWriter', label: 'Outreach Writer', description: 'Prepares concise personalized drafts.' },
  { key: 'escrowWatcher', label: 'Escrow Watcher', description: 'Tracks milestone lock and release state.' },
  { key: 'credentialMinter', label: 'Credential Minter', description: 'Prepares reputation proof after wins.' },
]

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onChange}
      className={checked ? 'relative h-7 w-12 rounded-full bg-primary transition-colors' : 'relative h-7 w-12 rounded-full bg-muted transition-colors'}
    >
      <span className={checked ? 'absolute left-6 top-1 h-5 w-5 rounded-full bg-[#03131d] transition-all' : 'absolute left-1 top-1 h-5 w-5 rounded-full bg-muted-foreground transition-all'} />
    </button>
  )
}

function FreelancerSettings() {
  const { data: profile, isLoading } = useFreelancerProfile()
  const { updateAgents } = useFreelancerMutations()
  const agentConfig = profile?.agentConfig || {}

  const updateAgent = async (key) => {
    try {
      await updateAgents.mutateAsync({ ...agentConfig, [key]: !agentConfig[key] })
      toast.success('Agent settings updated')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update agent settings')
    }
  }

  return (
    <FreelancerPageShell
      title="Freelancer Settings"
      description="Control the agent layer, wallet placeholders, and profile metadata for the freelancer operating system."
    >
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SkeletonPanel rows={8} />
          <SkeletonPanel rows={8} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <TechnicalPanel className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl border border-primary/25 bg-primary/10 p-3 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Agents</p>
                <h2 className="text-xl font-semibold">Automation controls</h2>
              </div>
            </div>
            <div className="space-y-3">
              {agentLabels.map((agent) => (
                <div key={agent.key} className="flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/35 p-4">
                  <div>
                    <p className="font-medium">{agent.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{agent.description}</p>
                  </div>
                  <Toggle checked={Boolean(agentConfig[agent.key])} onChange={() => updateAgent(agent.key)} />
                </div>
              ))}
            </div>
          </TechnicalPanel>

          <TechnicalPanel className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl border border-emerald-300/25 bg-emerald-400/10 p-3 text-emerald-200">
                <WalletCards className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Wallets</p>
                <h2 className="text-xl font-semibold">Payout endpoints</h2>
              </div>
            </div>
            <div className="space-y-3">
              {Object.entries(profile?.walletAddresses || {}).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-border/70 bg-background/35 p-4">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">{key}</p>
                  <p className="mt-2 break-all font-mono text-sm text-foreground">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-xl border border-border bg-background/35 p-4">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">DID</p>
              <p className="mt-2 break-all font-mono text-sm text-primary">{profile?.did}</p>
            </div>
          </TechnicalPanel>
        </div>
      )}
    </FreelancerPageShell>
  )
}

export default FreelancerSettings
