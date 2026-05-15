import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { SearchX, Users, MessageSquareX, BrainCog, Shuffle, MessageCircleQuestion } from 'lucide-react'

const problems = [
  {
    icon: SearchX,
    title: 'Finding the Right Clients',
    description: 'Freelancers spend more time searching for work than actually doing it. The right clients are hard to find.',
  },
  {
    icon: Users,
    title: 'Finding Reliable Talent',
    description: 'Clients struggle to discover skilled, trustworthy freelancers and developers who can deliver on time.',
  },
  {
    icon: Shuffle,
    title: 'Lack of Collaboration Tools',
    description: 'Developers need better ways to join teams, collaborate on projects, and find meaningful work.',
  },
  {
    icon: MessageSquareX,
    title: 'Scattered Communication',
    description: 'Project conversations happen across emails, chats, and calls — making it hard to track progress.',
  },
  {
    icon: BrainCog,
    title: 'No Smart Workflows',
    description: 'People need AI-assisted workflows to manage tasks, deadlines, and deliverables more efficiently.',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Building Without Feedback',
    description: 'Platforms often launch without understanding what real users actually need. Early feedback matters.',
  },
]

function ProblemSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="problems" className="py-24 sm:py-32">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            The Challenge
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Problems We Want to{' '}
            <span className="text-gradient-primary">Solve</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground leading-8">
            The freelance and collaboration ecosystem is broken in ways that cost everyone time, money, and missed opportunities.
          </p>
        </motion.div>

        {/* Problem Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem, index) => {
            const Icon = problem.icon
            return (
              <motion.div
                key={problem.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.08 }}
                className="landing-panel rounded-2xl p-6 group hover:border-primary/30 transition-colors duration-300"
              >
                <div className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-xl bg-destructive/10 text-destructive/80 group-hover:bg-destructive/15 transition-colors">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{problem.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{problem.description}</p>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default ProblemSection
