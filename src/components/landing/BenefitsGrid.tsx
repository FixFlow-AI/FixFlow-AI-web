import { motion } from 'framer-motion'
import { Zap, Target, Users, TrendingUp, Lock, Layers } from 'lucide-react'

const benefits = [
  {
    icon: Zap,
    title: '10x Faster Proposals',
    description: 'Reduce proposal creation time from days to minutes.',
  },
  {
    icon: Target,
    title: 'Higher Accuracy',
    description: 'AI-powered estimates based on thousands of similar projects.',
  },
  {
    icon: Users,
    title: 'Team Collaboration',
    description: 'Share and iterate on proposals with your entire team.',
  },
  {
    icon: TrendingUp,
    title: 'Data-Driven Insights',
    description: 'Market analysis and trend data built into every proposal.',
  },
  {
    icon: Lock,
    title: 'Enterprise Security',
    description: 'SOC 2 compliant with end-to-end encryption.',
  },
  {
    icon: Layers,
    title: 'Seamless Integration',
    description: 'Connect with Jira, Notion, and your existing tools.',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4 },
  },
}

function BenefitsGrid() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8">
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
            <span className="text-gradient">Why Choose</span>{' '}
            <span className="text-gradient-primary">Proplytics</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Built for modern teams who want to win more deals with better proposals.
          </p>
        </motion.div>

        {/* Benefits Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {benefits.map((benefit) => (
            <motion.div
              key={benefit.title}
              variants={itemVariants}
              whileHover={{ y: -4 }}
              className="p-6 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-primary/30 transition-all duration-300 group"
            >
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <benefit.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{benefit.title}</h3>
              <p className="text-sm text-muted-foreground">{benefit.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default BenefitsGrid
