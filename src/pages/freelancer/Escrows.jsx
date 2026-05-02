import toast from 'react-hot-toast'
import { AlertTriangle, ArrowRight, Banknote, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FreelancerPageShell, SkeletonPanel, StatusPill, TechnicalPanel } from '@/components/freelancer/FreelancerPrimitives'
import { useFreelancerEscrows, useFreelancerMutations } from '@/hooks/useFreelancer'

function EscrowFlow({ escrow, onRelease, onDispute, isBusy }) {
  return (
    <TechnicalPanel className="p-5">
      <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">{escrow.chain}</p>
          <h2 className="mt-2 text-2xl font-semibold">{escrow.totalAmount.toLocaleString()} {escrow.currency}</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{escrow.contractAddress}</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="rounded-lg border border-border bg-transparent px-3 py-2 font-mono text-xs transition-colors hover:bg-background/40 focus-within:bg-background/40">Client</span>
          <ArrowRight className="h-4 w-4 text-primary" />
          <span className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 font-mono text-xs text-primary">Smart lock</span>
          <ArrowRight className="h-4 w-4 text-primary" />
          <span className="rounded-lg border border-border bg-transparent px-3 py-2 font-mono text-xs transition-colors hover:bg-background/40 focus-within:bg-background/40">Freelancer</span>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {escrow.milestones.map((milestone, index) => (
          <div key={milestone.name} className="rounded-xl border border-border/70 bg-transparent p-4 transition-colors hover:bg-background/35 focus-within:bg-background/35">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{milestone.name}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{milestone.amount.toLocaleString()} {escrow.currency}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill status={milestone.status} />
                {milestone.status === 'locked' && (
                  <Button size="sm" isLoading={isBusy} onClick={() => onRelease(escrow.id, index)}>
                    Release
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" className="mt-5" isLoading={isBusy} onClick={() => onDispute(escrow.id)}>
        <AlertTriangle className="h-4 w-4" />
        Open dispute
      </Button>
    </TechnicalPanel>
  )
}

function Escrows() {
  const { data = {}, isLoading } = useFreelancerEscrows()
  const { releaseMilestone, disputeEscrow } = useFreelancerMutations()
  const escrows = data.escrows || []
  const invoices = data.invoices || []

  const release = async (escrowId, milestoneIndex) => {
    try {
      await releaseMilestone.mutateAsync({ escrowId, milestoneIndex })
      toast.success('Milestone released')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to release milestone')
    }
  }

  const dispute = async (escrowId) => {
    try {
      await disputeEscrow.mutateAsync(escrowId)
      toast.success('Dispute state recorded')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update escrow')
    }
  }

  return (
    <FreelancerPageShell
      title="Escrows"
      description="Milestone money, invoice state, and payout confidence in one trust-centered operating view."
    >
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <SkeletonPanel rows={8} />
          <SkeletonPanel rows={8} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            {escrows.map((escrow) => (
              <EscrowFlow
                key={escrow.id}
                escrow={escrow}
                onRelease={release}
                onDispute={dispute}
                isBusy={releaseMilestone.isPending || disputeEscrow.isPending}
              />
            ))}
          </div>

          <TechnicalPanel className="p-5">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-xl border border-primary/25 bg-primary/10 p-3 text-primary">
                <Banknote className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Invoices</p>
                <h2 className="text-xl font-semibold">Payment history</h2>
              </div>
            </div>
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="rounded-lg border border-border/70 bg-transparent p-3 transition-colors hover:bg-background/35 focus-within:bg-background/35">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{invoice.clientName}</p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{new Date(invoice.dueDate).toLocaleDateString()}</p>
                    </div>
                    <StatusPill status={invoice.status} />
                  </div>
                  <p className="mt-3 text-2xl font-semibold">{invoice.amount.toLocaleString()} {invoice.currency}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-400/10 p-4">
              <div className="flex items-center gap-2 text-emerald-100">
                <LockKeyhole className="h-4 w-4" />
                <span className="font-mono text-xs uppercase tracking-[0.2em]">Adapter ready</span>
              </div>
              <p className="mt-2 text-sm text-emerald-100/80">Web3 transactions are demo-backed until the chain adapter is connected.</p>
            </div>
          </TechnicalPanel>
        </div>
      )}
    </FreelancerPageShell>
  )
}

export default Escrows
