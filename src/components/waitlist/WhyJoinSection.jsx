import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { useRef, useState } from 'react'
import { Rocket, Lightbulb, MessageSquareHeart, UserCheck, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const benefits = [
  { icon: Rocket, title: 'Get Early Access Updates', description: 'Be the first to know when new features launch and get priority access to the platform.' },
  { icon: Lightbulb, title: 'Help Shape the Platform', description: 'Your feedback and ideas directly influence what we build. Shape the tools you will use.' },
  { icon: MessageSquareHeart, title: 'Share What You Need', description: 'Tell us what you are looking for — we listen and build features based on real demand.' },
  { icon: UserCheck, title: 'Be Among the First Users', description: 'When Fix Flow AI launches, waitlist members get first access — before anyone else.' },
  { icon: Settings2, title: 'Influence Features for Your Role', description: 'Whether freelancer, client, or developer — your role-specific needs guide our roadmap.' },
]

function BenefitCard({ benefit, index, isInView }) {
  const Icon = benefit.icon
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: 60, filter: 'blur(8px)' }}
      animate={isInView ? { opacity: 1, x: 0, filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.6, delay: 0.15 + index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ x: -6, scale: 1.02 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className="landing-panel rounded-xl p-5 flex gap-4 items-start group hover:border-primary/30 transition-all duration-300 cursor-default"
    >
      <motion.div
        className="shrink-0 inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15"
        animate={isHovered ? { rotate: [0, -10, 10, 0], scale: 1.1 } : { rotate: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Icon className="h-5 w-5" />
      </motion.div>
      <div>
        <h3 className="font-semibold text-foreground mb-1">{benefit.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
      </div>
    </motion.div>
  )
}

function WhyJoinSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const yShift = useTransform(scrollYProgress, [0, 1], [40, -40])

  const handleScroll = (e) => {
    e.preventDefault()
    const el = document.querySelector('#waitlist-form')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section id="why-join" className="py-24 sm:py-32 overflow-hidden">
      <motion.div ref={ref} style={{ y: yShift }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
          {/* Left: Header + CTA */}
          <motion.div
            initial={{ opacity: 0, x: -50, filter: 'blur(10px)' }}
            animate={isInView ? { opacity: 1, x: 0, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.span
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary inline-block"
              initial={{ opacity: 0, letterSpacing: '0.5em' }}
              animate={isInView ? { opacity: 1, letterSpacing: '0.22em' } : {}}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              Why Now
            </motion.span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Why Join the{' '}<span className="text-gradient-primary">Waitlist?</span>
            </h2>
            <motion.div
              className="mt-3 h-1 rounded-full bg-gradient-to-r from-primary via-primary/50 to-transparent"
              initial={{ width: 0, opacity: 0 }}
              animate={isInView ? { width: 100, opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
            <p className="mt-5 text-lg text-muted-foreground leading-8 max-w-lg">
              The best platforms are built with their users. Join now to become part of the foundation of Fix Flow AI — and get rewarded for being early.
            </p>
            <motion.div
              className="mt-8"
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <motion.a
                href="#waitlist-form"
                onClick={handleScroll}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.97 }}
                className="inline-block"
              >
                <Button size="lg" className="glow-effect">
                  Join the Waitlist Now
                  <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    <Rocket className="h-4 w-4" />
                  </motion.span>
                </Button>
              </motion.a>
            </motion.div>
          </motion.div>

          {/* Right: Benefit Cards */}
          <div className="space-y-4">
            {benefits.map((benefit, index) => (
              <BenefitCard key={benefit.title} benefit={benefit} index={index} isInView={isInView} />
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  )
}

export default WhyJoinSection
