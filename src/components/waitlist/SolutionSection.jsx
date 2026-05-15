import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Cpu, Eye, Handshake, UserCog, MessageSquareText, HeartHandshake } from 'lucide-react'

const solutions = [
  {
    icon: Cpu,
    title: 'AI-Powered Matching',
    description: 'Intelligent algorithms connect freelancers, clients, and developers with the right opportunities based on skills, needs, and goals.',
  },
  {
    icon: Eye,
    title: 'Workflow Clarity',
    description: 'Clear, structured workflows eliminate confusion — everyone knows what to do, when, and how progress is tracking.',
  },
  {
    icon: Handshake,
    title: 'Smarter Collaboration',
    description: 'Built-in tools for project communication, file sharing, and task management — all in one connected workspace.',
  },
  {
    icon: UserCog,
    title: 'Role-Based Experience',
    description: 'Whether you are a freelancer, client, or developer, the platform adapts to your role with tailored dashboards and tools.',
  },
  {
    icon: MessageSquareText,
    title: 'Feedback-Driven Development',
    description: 'Every feature we build is shaped by real user feedback — your input directly influences the platform.',
  },
  {
    icon: HeartHandshake,
    title: 'Built for Real Needs',
    description: 'Not another generic platform. Fix Flow AI is designed around actual pain points shared by early users like you.',
  },
]

function SolutionSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="solutions" className="py-24 sm:py-32">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            Our Approach
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            How Fix Flow AI{' '}
            <span className="text-gradient-primary">Helps</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground leading-8">
            We are building a platform that puts people first — connecting talent with opportunity through intelligent, AI-driven workflows.
          </p>
        </motion.div>

        {/* Solution Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((solution, index) => {
            const Icon = solution.icon
            return (
              <motion.div
                key={solution.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="landing-future-card rounded-2xl p-6 group hover:border-primary/40 transition-colors duration-300"
              >
                <div className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{solution.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{solution.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default SolutionSection
