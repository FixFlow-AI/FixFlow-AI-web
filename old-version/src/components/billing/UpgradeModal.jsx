import Modal from '@/components/ui/Modal'
import PlanCard from './PlanCard'
import { BILLING_PLANS } from '@/lib/billing'

export default function UpgradeModal({ isOpen, onClose, currentPlan, priceIdsConfigured = {}, isLoading, onSelect }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Upgrade FixFlowAI" description="Choose the plan that matches your proposal volume.">
      <div className="grid gap-4 md:grid-cols-3">
        {BILLING_PLANS.filter((plan) => plan.slug !== 'free').map((plan) => (
          <PlanCard
            key={plan.slug}
            plan={plan}
            currentPlan={currentPlan}
            canCheckout={Boolean(priceIdsConfigured[plan.slug])}
            isLoading={isLoading}
            onSelect={onSelect}
          />
        ))}
      </div>
    </Modal>
  )
}
