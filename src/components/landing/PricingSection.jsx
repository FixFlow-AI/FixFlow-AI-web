import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    slug: 'free',
    description: 'Start personal proposal creation and lightweight collaboration.',
    features: ['Single proposal generation', 'Dashboard and exports', 'Basic workspace collaboration'],
  },
  {
    name: 'Standard',
    price: '$10',
    slug: 'standard',
    description: 'Unlock Agency Brain and stronger workflow visibility.',
    features: ['Agency Brain insights', 'Calibration-aware generation', '5-seat team workspace'],
  },
  {
    name: 'Pro',
    price: '$25',
    slug: 'pro',
    description: 'Run the full platform with TriProposal and advanced sharing.',
    features: ['TriProposal generation', 'Bundle sharing portal', '10-seat team workspace'],
  },
]

export default function PricingSection() {
  const [mode, setMode] = useState('individual')

  return (
    <section id="pricing" className="px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className="text-xs uppercase tracking-[0.24em] text-primary">Pricing</p>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">Choose your FixFlowAI operating mode</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground">
            The pricing is intentionally simple right now: the same three tiers for individual operators and team workspaces.
          </p>
        </motion.div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-border bg-background/35 p-1">
            {['individual', 'team'].map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                  mode === item ? 'bg-primary text-[#03131d]' : 'text-muted-foreground'
                }`}
              >
                {item === 'individual' ? 'Individual' : 'Team'}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="glass-card rounded-[32px] p-6"
            >
              <div className="text-xs uppercase tracking-[0.2em] text-primary">{mode}</div>
              <h3 className="mt-4 text-2xl font-semibold">{plan.name}</h3>
              <div className="mt-2 text-4xl font-bold">{plan.price}<span className="text-sm text-muted-foreground"> / month</span></div>
              <p className="mt-4 text-sm text-muted-foreground">{plan.description}</p>

              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                {plan.features.map((feature) => (
                  <div key={feature} className="rounded-2xl border border-border bg-background/25 px-4 py-3">
                    {feature}
                  </div>
                ))}
              </div>

              <Link to={`/register?mode=${mode}&plan=${plan.slug}`} className="mt-6 block">
                <Button className="w-full">
                  Choose {plan.name}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
