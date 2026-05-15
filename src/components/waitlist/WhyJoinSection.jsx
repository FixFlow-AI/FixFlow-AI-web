import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Rocket, Lightbulb, MessageSquareHeart, UserCheck, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const benefits = [
  {
    icon: Rocket,
    title: 'Get Early Access Updates',
    description: 'Be the first to know when new features launch and get priority access to the platform.',
  },
  {
    icon: Lightbulb,
    title: 'Help Shape the Platform',
    description: 'Your feedback and ideas directly influence what we build. Shape the tools you will use.',
  },
  {
    icon: MessageSquareHeart,
    title: 'Share What You Need',
    description: 'Tell us what you are looking for — we listen and build features based on real demand.',
  },
  {
    icon: UserCheck,
    title: 'Be Among the First Users',
    description: 'When Fix Flow AI launches, waitlist members get first access — before anyone else.',
  },
  {
    icon: Settings2,
    title: 'Influence Features for Your Role',
    description: 'Whether freelancer, client, or developer — your role-specific needs guide our roadmap.',
  },
]

function WhyJoinSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  const handleScroll = (e) => {
    e.preventDefault()
    const el = document.querySelector('#waitlist-form')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section id="why-join" className="py-24 sm:py-32">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left: Header + CTA */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
              Why Now
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Why Join the{' '}
              <span className="text-gradient-primary">Waitlist?</span>
            </h2>
            <p className="mt-5 text-lg text-muted-foreground leading-8 max-w-lg">
              The best platforms are built with their users. Join now to become part of the foundation of Fix Flow AI — and get rewarded for being early.
            </p>
            <div className="mt-8">
              <a href="#waitlist-form" onClick={handleScroll}>
                <Button size="lg" className="glow-effect">
                  Join the Waitlist Now
                  <Rocket className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </motion.div>

          {/* Right: Benefit Cards */}
          <div className="space-y-4">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <motion.div
                  key={benefit.title}
                  initial={{ opacity: 0, x: 30 }}
                  animate={isInView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  className="landing-panel rounded-xl p-5 flex gap-4 items-start group hover:border-primary/30 transition-colors duration-300"
                >
                  <div className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{benefit.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}

export default WhyJoinSection
