import { useMutation, useQuery } from '@tanstack/react-query'
import { CreditCard, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import PlanCard from '@/components/billing/PlanCard'
import UsageMeter from '@/components/billing/UsageMeter'
import { Button } from '@/components/ui/Button'
import { BILLING_PLANS, createCheckoutSession, createPortalSession, getBillingStatus } from '@/lib/billing'
import useAuthStore from '@/stores/authStore'

export default function Billing() {
  const user = useAuthStore((state) => state.user)
  const checkAuth = useAuthStore((state) => state.checkAuth)

  const billingQuery = useQuery({
    queryKey: ['billing-status'],
    queryFn: getBillingStatus,
  })

  const checkoutMutation = useMutation({
    mutationFn: createCheckoutSession,
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Unable to start Stripe Checkout.')
    },
  })

  const portalMutation = useMutation({
    mutationFn: createPortalSession,
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.location.href = data.portalUrl
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Unable to open the billing portal.')
    },
  })

  const status = billingQuery.data
  const currentPlan = status?.plan || user?.plan || 'free'
  const usage = status?.usage || user?.billingUsage

  return (
    <div className="mx-auto max-w-7xl space-y-8" data-testid="billing-page">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Billing</p>
          <h1 className="mt-2 text-3xl font-bold">Plan, usage, and subscription</h1>
          <p className="mt-3 max-w-3xl text-muted-foreground">
            Stripe is the source of truth for paid access. Usage gates are enforced by the backend before proposal generation.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => portalMutation.mutate()}
          disabled={!status?.stripeCustomerId || portalMutation.isPending}
        >
          <CreditCard className="h-4 w-4" />
          Manage Subscription
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="glass-card rounded-[28px] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Current plan</p>
              <h2 className="mt-2 text-2xl font-semibold capitalize">{currentPlan}</h2>
            </div>
            <span className="rounded-full border border-border bg-background/40 px-3 py-1 text-xs capitalize text-muted-foreground">
              {status?.subscriptionStatus || user?.subscriptionStatus || 'none'}
            </span>
          </div>
          <div className="mt-6">
            <UsageMeter usage={usage} />
          </div>
          {!status?.stripeConfigured ? (
            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
              Stripe is not configured on this backend. Add Stripe env vars to enable live checkout.
            </div>
          ) : null}
        </div>

        <div className="glass-card rounded-[28px] p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Account state</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Refresh after a webhook event to hydrate the latest plan and usage counters.
              </p>
            </div>
            <Button variant="outline" onClick={() => {
              billingQuery.refetch()
              checkAuth()
            }}>
              Refresh status
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {BILLING_PLANS.map((plan) => (
          <PlanCard
            key={plan.slug}
            plan={plan}
            currentPlan={currentPlan}
            canCheckout={Boolean(status?.priceIdsConfigured?.[plan.slug]) && Boolean(status?.stripeConfigured)}
            isLoading={checkoutMutation.isPending}
            onSelect={(planSlug) => checkoutMutation.mutate(planSlug)}
          />
        ))}
      </div>

      <div className="glass-card rounded-[28px] p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Need the Scale plan?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Scale is handled by direct sales because it includes SSO, audit logs, and custom support terms.</p>
          </div>
          <a href="mailto:hello@fixflowai.com?subject=FixFlowAI%20Scale%20plan" className="inline-flex items-center gap-2 text-sm font-medium text-primary">
            Contact sales <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>
  )
}
