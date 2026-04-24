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
    if (!portalPayload?.proposal) return null
    return normalizeProposalRecord({
      title: portalPayload.proposal.title,
      projectSummary: portalPayload.proposal.projectSummary,
      data: portalPayload.proposal.data,
    })
  }, [portalPayload])

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
            <ClientFeedbackForm onSubmit={handleFeedbackSubmit} />
          </>
        )}
      </div>
    </div>
  )
}
