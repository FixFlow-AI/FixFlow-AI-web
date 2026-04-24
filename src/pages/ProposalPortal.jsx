import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { useParams } from 'react-router-dom'
import { PageLoader } from '@/components/ui/PageLoader'
import WorkspaceBackdrop from '@/components/ui/WorkspaceBackdrop'
import PortalBanner from '@/components/portal/PortalBanner'
import PinGate from '@/components/portal/PinGate'
import ClientFeedbackForm from '@/components/portal/ClientFeedbackForm'
import ProposalReadonlyView from '@/components/proposal/ProposalReadonlyView'
import { usePortalTracking } from '@/hooks/usePortalTracking'
import { normalizeProposalRecord } from '@/lib/proposals'
import { API_BASE_URL } from '@/config/api'

async function fetchJson(url, options) {
  const response = await fetch(url, options)
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'Request failed.')
  }

  return data
}

export default function ProposalPortal() {
  const { token } = useParams()
  const [meta, setMeta] = useState(null)
  const [portalPayload, setPortalPayload] = useState(null)
  const [selectedStrategyId, setSelectedStrategyId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isVerifying, setIsVerifying] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let ignore = false

    fetchJson(`${API_BASE_URL}/portal/${token}`)
      .then((data) => {
        if (ignore) return
        setMeta(data)
        setError('')
        if (!data.requiresPin) {
          setIsVerifying(true)
          return fetchJson(`${API_BASE_URL}/portal/${token}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
          }).then((payload) => {
            if (!ignore) {
              setPortalPayload(payload)
              if (payload.bundle?.proposals?.length) {
                setSelectedStrategyId(payload.bundle.proposals[0].proposalId)
              }
            }
          })
        }
        return null
      })
      .catch((loadError) => {
        if (!ignore) {
          setError(loadError.message || 'Portal could not be loaded.')
        }
      })
      .finally(() => {
        if (!ignore) {
          setIsLoading(false)
          setIsVerifying(false)
        }
      })

    return () => {
      ignore = true
    }
  }, [token])

  const proposal = useMemo(() => {
    if (portalPayload?.bundle?.proposals?.length) {
      const selected = portalPayload.bundle.proposals.find((item) => item.proposalId === selectedStrategyId)
        || portalPayload.bundle.proposals[0]

      if (!selected) {
        return null
      }

      return normalizeProposalRecord({
        proposalId: selected.proposalId,
        title: selected.title,
        strategy: selected.strategy,
        projectSummary: selected.projectSummary,
        data: selected.data,
      })
    }

    if (!portalPayload?.proposal) return null
    return normalizeProposalRecord({
      title: portalPayload.proposal.title,
      projectSummary: portalPayload.proposal.projectSummary,
      data: portalPayload.proposal.data,
    })
  }, [portalPayload, selectedStrategyId])

  const { registerSectionRef, flushPending } = usePortalTracking(token, Boolean(proposal))

  const handleVerify = async (pin) => {
    setIsVerifying(true)
    try {
      const payload = await fetchJson(`${API_BASE_URL}/portal/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      })
      setPortalPayload(payload)
      if (payload.bundle?.proposals?.length) {
        setSelectedStrategyId(payload.bundle.proposals[0].proposalId)
      }
      toast.success('Portal unlocked.')
    } catch (verifyError) {
      toast.error(verifyError.message || 'PIN verification failed.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleFeedbackSubmit = async (message) => {
    await fetchJson(`${API_BASE_URL}/portal/${token}/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
  }

  useEffect(() => {
    return () => {
      flushPending()
    }
  }, [flushPending])

  if (isLoading) {
    return <PageLoader />
  }

  if (error) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background px-4 py-10">
        <WorkspaceBackdrop />
        <div className="relative z-10 mx-auto max-w-2xl glass-card rounded-[32px] p-8 text-center">
          <h1 className="text-3xl font-semibold">Portal unavailable</h1>
          <p className="mt-3 text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background px-4 py-8 md:px-8">
      <WorkspaceBackdrop />
      <div className="relative z-10 mx-auto max-w-6xl space-y-8">
        <PortalBanner agencyName={meta?.agencyName || portalPayload?.proposal?.agencyName} expiryAt={meta?.expiryAt} />

        {!proposal ? (
          <PinGate onVerify={handleVerify} isLoading={isVerifying} />
        ) : (
          <>
            {portalPayload?.bundle?.proposals?.length ? (
              <div className="grid gap-3 rounded-[28px] border border-border bg-card/60 p-5 lg:grid-cols-3">
                {portalPayload.bundle.proposals.map((item) => (
                  <button
                    key={item.proposalId}
                    type="button"
                    onClick={() => setSelectedStrategyId(item.proposalId)}
                    className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                      (selectedStrategyId || portalPayload.bundle.proposals[0].proposalId) === item.proposalId
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-background/30'
                    }`}
                  >
                    <div className="text-xs uppercase tracking-[0.2em] text-primary">{item.strategy}</div>
                    <div className="mt-2 font-medium">{item.title}</div>
                    <div className="mt-2 text-sm text-muted-foreground">Request this approach if it best matches your goals.</div>
                  </button>
                ))}
              </div>
            ) : null}
            <ProposalReadonlyView
              proposal={proposal}
              sectionRefs={{
                summary: registerSectionRef('summary'),
                features: registerSectionRef('features'),
                risks: registerSectionRef('risks'),
                timeline: registerSectionRef('timeline'),
                effort: registerSectionRef('effort'),
                market: registerSectionRef('market'),
                impact: registerSectionRef('impact'),
              }}
            />
            <ClientFeedbackForm
              onSubmit={handleFeedbackSubmit}
              initialMessage={
                portalPayload?.bundle?.proposals?.length
                  ? `We want to move forward with the ${proposal.strategy} approach because `
                  : ''
              }
              title={
                portalPayload?.bundle?.proposals?.length
                  ? 'Request this proposal strategy'
                  : 'Send feedback directly to the agency'
              }
            />
          </>
        )}
      </div>
    </div>
  )
}
