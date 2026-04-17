import { motion } from 'framer-motion'
import { Brain, Shield, Clock, Calculator } from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'Instant Brief Analysis',
    description: 'Our AI parses complex client briefs in seconds, extracting key requirements, constraints, and objectives automatically.',
  },
  {
    icon: Shield,
    title: 'Risk Assessment',
    description: 'Identify potential technical, operational, and business risks before they become problems with AI-powered analysis.',
  },
  {
    icon: Clock,
    title: 'Smart Timeline Generation',
    description: 'Generate realistic project timelines with dependencies, milestones, and buffer periods based on similar projects.',
  },
  {
    icon: Calculator,
    title: 'Effort Estimation',
    description: 'Get accurate effort breakdowns by layer (AI, Backend, Frontend, DevOps) with confidence scores.',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
}

function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            <span className="text-gradient">Powerful Features for</span>{' '}
            <span className="text-gradient-primary">Modern Teams</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Everything you need to transform client conversations into actionable project plans.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {features.map((feature) => (
            <motion.div
              key={feature.title}
              variants={itemVariants}
              whileHover={{ scale: 1.02, y: -4 }}
              className="glass-card rounded-2xl p-8 group cursor-pointer"
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
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default FeaturesSection
