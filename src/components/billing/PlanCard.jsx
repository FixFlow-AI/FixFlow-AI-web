import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function PlanCard({ plan, currentPlan, canCheckout, isLoading, onSelect }) {
  const isCurrent = currentPlan === plan.slug
  const isPaid = plan.slug !== 'free'

  return (
    <div
      className={`glass-card rounded-[28px] p-6 ${isCurrent ? 'border-primary/60 bg-primary/5' : ''}`}
      data-testid={`billing-plan-${plan.slug}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{plan.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
        </div>
        {isCurrent ? (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Current
          </span>
        ) : null}
      </div>

      <div className="mt-6 text-4xl font-bold">
        {plan.price}
        {plan.price.startsWith('$') ? <span className="text-sm font-medium text-muted-foreground"> / month</span> : null}
      </div>

      <div className="mt-6 space-y-3">
        {plan.features.map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            {feature}
          </div>
        ))}
      </div>

      <Button
        className="mt-6 w-full"
        variant={isCurrent ? 'outline' : 'default'}
        disabled={isCurrent || !isPaid || !canCheckout}
        isLoading={isLoading}
        onClick={() => onSelect(plan.slug)}
      >
        {isCurrent ? 'Active plan' : isPaid ? 'Upgrade' : 'Included'}
      </Button>

      {isPaid && !canCheckout ? (
        <p className="mt-3 text-xs text-muted-foreground">Stripe price for this plan is not configured yet.</p>
      ) : null}
    </div>
  )
}
