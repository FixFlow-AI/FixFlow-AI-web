import { motion, useInView, useScroll, useTransform } from 'framer-motion'
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

function SolutionCard({ solution, index, isInView }) {
  const cardRef = useRef(null)
  const Icon = solution.icon

  // Alternating slide direction for visual interest
  const isEvenRow = Math.floor(index / 3) % 2 === 0
  const slideDir = isEvenRow ? (index % 2 === 0 ? -60 : 60) : (index % 2 === 0 ? 60 : -60)

  const handleMouseMove = (e) => {
    const card = cardRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const centerX = rect.width / 2
    const centerY = rect.height / 2
    const rotateX = (y - centerY) / 14
    const rotateY = (centerX - x) / 14
    card.style.transform = `perspective(600px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`
  }

  const handleMouseLeave = () => {
    const card = cardRef.current
    if (card) card.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)'
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: slideDir, y: 30, filter: 'blur(8px)' }}
      animate={isInView ? { opacity: 1, x: 0, y: 0, filter: 'blur(0px)' } : {}}
      transition={{
        duration: 0.7,
        delay: index * 0.1,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="landing-future-card rounded-2xl p-6 group hover:border-primary/40 transition-all duration-300 will-change-transform cursor-default h-full"
        style={{ transition: 'transform 0.15s ease-out' }}
      >
        <motion.div
          className="mb-4 inline-flex items-center justify-center h-12 w-12 rounded-xl bg-primary/10 text-primary group-hover:bg-primary/15"
          whileHover={{ scale: 1.2, rotate: 12 }}
          transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
          <Icon className="h-6 w-6" />
        </motion.div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{solution.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{solution.description}</p>
      </div>
    </motion.div>
  )
}

function SolutionSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const yShift = useTransform(scrollYProgress, [0, 1], [40, -40])

  return (
    <section id="solutions" className="py-24 sm:py-32 overflow-hidden">
      <motion.div ref={ref} style={{ y: yShift }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
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
            Our Approach
          </motion.span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            How Fix Flow AI{' '}
            <span className="text-gradient-primary">Helps</span>
          </h2>
          <motion.div
            className="mt-3 mx-auto h-1 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
            initial={{ width: 0, opacity: 0 }}
            animate={isInView ? { width: 120, opacity: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
          />
          <p className="mt-5 text-lg text-muted-foreground leading-8">
            We are building a platform that puts people first — connecting talent with opportunity through intelligent, AI-driven workflows.
          </p>
        </motion.div>

        {/* Solution Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {solutions.map((solution, index) => (
            <SolutionCard key={solution.title} solution={solution} index={index} isInView={isInView} />
          ))}
        </div>
      </motion.div>
    </section>
  )
}

export default SolutionSection
