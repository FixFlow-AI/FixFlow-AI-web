import toast from 'react-hot-toast'
import { Copy, Fingerprint, Share2, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { FreelancerPageShell, SkeletonPanel, StatusPill, TechnicalPanel } from '@/components/freelancer/FreelancerPrimitives'
import { useFreelancerCredentials, useFreelancerMutations, useFreelancerProfile } from '@/hooks/useFreelancer'

function IdentityVault() {
  const { data: profile, isLoading: profileLoading } = useFreelancerProfile()
  const { data: credentials = [], isLoading: credentialsLoading } = useFreelancerCredentials()
  const { mintCredential } = useFreelancerMutations()
  const isLoading = profileLoading || credentialsLoading

  const copyDid = async () => {
    await navigator.clipboard?.writeText(profile?.did || '')
    toast.success('DID copied')
  }

  const mint = async () => {
    try {
      await mintCredential.mutateAsync('Verified Freelancer OS delivery')
      toast.success('Credential minted')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to mint credential')
    }
  }

  return (
    <FreelancerPageShell
      title="Identity Vault"
      description="Reputation, skill proof, DID metadata, and wallet placeholders for an eventual verifiable freelancer graph."
    >
      {isLoading ? (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <SkeletonPanel rows={8} />
          <SkeletonPanel rows={8} />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <TechnicalPanel className="p-6">
            <div className="rounded-2xl border border-primary/30 bg-transparent p-5 transition-colors hover:bg-background/45 focus-within:bg-background/45">
              <div className="flex items-center justify-between gap-4">
                <ShieldCheck className="h-8 w-8 text-primary" />
                <StatusPill status="minted" />
              </div>
              <h2 className="mt-8 text-2xl font-semibold">Soulbound Reputation</h2>
              <p className="mt-3 break-all font-mono text-xs leading-6 text-muted-foreground">{profile?.did}</p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-border bg-transparent p-3 transition-colors hover:bg-card focus-within:bg-card">
                  <p className="text-2xl font-semibold">{credentials.length}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Proofs</p>
                </div>
                <div className="rounded-lg border border-border bg-transparent p-3 transition-colors hover:bg-card focus-within:bg-card">
                  <p className="text-2xl font-semibold">3</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Wallets</p>
                </div>
                <div className="rounded-lg border border-border bg-transparent p-3 transition-colors hover:bg-card focus-within:bg-card">
                  <p className="text-2xl font-semibold">91</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Score</p>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="outline" onClick={copyDid}>
                <Copy className="h-4 w-4" />
                Copy DID
              </Button>
              <Button variant="outline">
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            </div>
          </TechnicalPanel>

          <TechnicalPanel className="p-6">
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-primary">Credentials</p>
                <h2 className="mt-1 text-2xl font-semibold">Verifiable skill graph</h2>
              </div>
              <Button onClick={mint} isLoading={mintCredential.isPending}>
                <Fingerprint className="h-4 w-4" />
                Mint proof
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {credentials.map((credential) => (
                <div key={credential.id} className="rounded-xl border border-border/75 bg-transparent p-4 transition-colors hover:border-primary/40 hover:bg-background/35 focus-within:bg-background/35">
                  <div className="flex items-start justify-between gap-4">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    <StatusPill status={credential.status} />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{credential.skill}</h3>
                  <p className="mt-3 break-all font-mono text-xs leading-6 text-muted-foreground">{credential.proof}</p>
                  <div className="mt-4 rounded-lg bg-transparent p-3 transition-colors hover:bg-card focus-within:bg-card">
                    <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Evidence</p>
                    <p className="mt-1 text-sm">{credential.evidence?.leadName || 'FixFlowAI'}</p>
                  </div>
                </div>
              ))}
            </div>
          </TechnicalPanel>
        </div>
      )}
    </FreelancerPageShell>
  )
}

export default IdentityVault
