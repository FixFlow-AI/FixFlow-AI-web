import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Brain, Shield, Clock, Calculator } from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'Agency Brain',
    description: 'Turn your proposal history into a calibration layer that shapes future estimates, stack choices, and risk framing.',
  },
  {
    icon: Shield,
    title: 'TriProposal',
    description: 'Generate Lean, Standard, and Premium strategies in parallel so every brief becomes a sales conversation, not a single take-it-or-leave-it output.',
  },
  {
    icon: Clock,
    title: 'Team Workspace',
    description: 'Invite teammates, track who is reviewing live, and keep proposal comments and approvals inside the product.',
  },
  {
    icon: Calculator,
    title: 'Confidence-Led Delivery',
    description: 'Keep the original Proplytics strengths: BriefScore, confidence grids, lifecycle tracking, export, and client portals.',
  },
]

function FeatureCard({ feature, index }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 95%", "start 30%"]
  })

  // Parallax transform wrapper
  const y = useTransform(scrollYProgress, [0, 1], [150 + index * 40, 0])
  const opacity = useTransform(scrollYProgress, [0, 1], [0, 1])

  return (
    <motion.div ref={ref} style={{ y, opacity }}>
      <motion.div
        whileHover={{ scale: 1.02, y: -4 }}
        className="glass-card rounded-2xl p-8 group cursor-pointer h-full"
      >
        <div className="flex items-start gap-5">
          <div className="relative shrink-0">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-colors" />
            <div className="relative h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <feature.icon className="h-7 w-7 text-primary" />
            </div>
          </div>
          <div>
            <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
              {feature.title}
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {feature.description}
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function FeaturesSection() {
  const sectionRef = useRef(null)
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  })
  
  // Subtle parallax for the section header
  const headerY = useTransform(scrollYProgress, [0, 0.5], [100, 0])
  const headerOpacity = useTransform(scrollYProgress, [0, 0.3], [0, 1])

  return (
    <section id="features" ref={sectionRef} className="py-24 px-4 sm:px-6 lg:px-8 relative z-10 bg-background">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          style={{ y: headerY, opacity: headerOpacity }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-gradient">Powerful Features for</span>{' '}
            <span className="text-gradient-primary">Modern Teams</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Proplytics now spans single-user delivery, agency memory, strategic proposal options, and team collaboration.
          </p>
        </motion.div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default FeaturesSection
