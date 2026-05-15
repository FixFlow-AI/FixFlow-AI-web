import { motion, useInView, useScroll, useTransform } from 'framer-motion'
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

// Individual card with 3D tilt on hover
function ProblemCard({ problem, index, isInView }) {
  const cardRef = useRef(null)
  const Icon = problem.icon

  const handleMouseMove = (e) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = (y - centerY) / 12
    const rotateY = (centerX - x) / 12
    card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`
  }

  const handleMouseLeave = () => {
    const card = cardRef.current
    if (card) card.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9, filter: 'blur(10px)' }}
      animate={isInView ? { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' } : {}}
      transition={{
        duration: 0.6,
        delay: index * 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="landing-panel rounded-2xl p-6 group hover:border-primary/30 transition-all duration-300 will-change-transform cursor-default"
        style={{ transition: 'transform 0.15s ease-out' }}
      >
        <motion.div
          className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-xl bg-destructive/10 text-destructive/80 group-hover:bg-destructive/15"
          whileHover={{ rotate: [0, -10, 10, 0], scale: 1.15 }}
          transition={{ duration: 0.5 }}
        >
          <Icon className="h-6 w-6" />
        </motion.div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{problem.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{problem.description}</p>
      </div>
    </motion.div>
  )
}

function ProblemSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })

  // Subtle parallax on the whole section
  const yShift = useTransform(scrollYProgress, [0, 1], [40, -40])

  return (
    <section id="problems" className="py-24 sm:py-32 overflow-hidden">
      <motion.div ref={ref} style={{ y: yShift }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header with scale-in */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <motion.span
            className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary inline-block"
            initial={{ opacity: 0, letterSpacing: '0.5em' }}
            animate={isInView ? { opacity: 1, letterSpacing: '0.22em' } : {}}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            The Challenge
          </motion.span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Problems We Want to{' '}
            <span className="text-gradient-primary">Solve</span>
          </h2>
          <motion.div
            className="mt-3 mx-auto h-1 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
            initial={{ width: 0, opacity: 0 }}
            animate={isInView ? { width: 120, opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
          />
          <p className="mt-5 text-lg text-muted-foreground leading-8">
            The freelance and collaboration ecosystem is broken in ways that cost everyone time, money, and missed opportunities.
          </p>
        </motion.div>

        {/* Problem Cards Grid with 3D tilt */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {problems.map((problem, index) => (
            <ProblemCard key={problem.title} problem={problem} index={index} isInView={isInView} />
          ))}
        </div>
      </motion.div>
    </section>
  )
}

export default ProblemSection
