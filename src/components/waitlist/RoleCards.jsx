import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Briefcase, Building2, Code2, Sparkles, Search, Users, Rocket, Zap, GitBranch, Brain, Target, Layers } from 'lucide-react'

const roles = [
  {
    title: 'Freelancer',
    subtitle: 'Get work. Grow smarter.',
    icon: Briefcase,
    color: 'from-emerald-500/20 to-emerald-500/5',
    borderColor: 'hover:border-emerald-400/40',
    iconBg: 'bg-emerald-500/15 text-emerald-400',
    points: [
      { icon: Sparkles, text: 'Showcase your skills and portfolio' },
      { icon: Search, text: 'Find relevant opportunities effortlessly' },
      { icon: Users, text: 'Connect with clients who need your talent' },
      { icon: Rocket, text: 'Grow with AI-assisted workflow tools' },
    ],
  },
  {
    title: 'Client',
    subtitle: 'Find talent. Build faster.',
    icon: Building2,
    color: 'from-blue-500/20 to-blue-500/5',
    borderColor: 'hover:border-blue-400/40',
    iconBg: 'bg-blue-500/15 text-blue-400',
    points: [
      { icon: Target, text: 'Discover skilled and reliable talent' },
      { icon: Layers, text: 'Share your project needs clearly' },
      { icon: Search, text: 'Understand who is interested in your work' },
      { icon: Zap, text: 'Build faster with the right people' },
    ],
  },
  {
    title: 'Developer',
    subtitle: 'Collaborate. Build. Innovate.',
    icon: Code2,
    color: 'from-violet-500/20 to-violet-500/5',
    borderColor: 'hover:border-violet-400/40',
    iconBg: 'bg-violet-500/15 text-violet-400',
    points: [
      { icon: GitBranch, text: 'Collaborate on real projects' },
      { icon: Users, text: 'Join technical teams and communities' },
      { icon: Layers, text: 'Build smarter workflows together' },
      { icon: Brain, text: 'Use AI to improve your productivity' },
    ],
  },
]

function RoleCards() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="roles" className="py-24 sm:py-32">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary">
            Built for You
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Three Roles,{' '}
            <span className="text-gradient-primary">One Platform</span>
          </h2>
          <p className="mt-5 text-lg text-muted-foreground leading-8">
            Fix Flow AI is designed to serve freelancers, clients, and developers — each with a tailored experience.
          </p>
        </motion.div>

        {/* Role Cards */}
        <div className="grid gap-8 lg:grid-cols-3">
          {roles.map((role, index) => {
            const RoleIcon = role.icon
            return (
              <motion.div
                key={role.title}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.12 }}
                className={`glass-card rounded-2xl p-8 group ${role.borderColor} transition-all duration-300 hover:shadow-[0_30px_80px_rgba(0,0,0,0.3)]`}
              >
                {/* Card Gradient Overlay */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${role.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />

                <div className="relative">
                  {/* Icon */}
                  <div className={`mb-6 inline-flex items-center justify-center h-14 w-14 rounded-2xl ${role.iconBg} transition-colors`}>
                    <RoleIcon className="h-7 w-7" />
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-bold text-foreground mb-1">{role.title}</h3>
                  <p className="text-sm text-muted-foreground mb-6">{role.subtitle}</p>

                  {/* Points */}
                  <ul className="space-y-4">
                    {role.points.map((point) => {
                      const PointIcon = point.icon
                      return (
                        <li key={point.text} className="flex items-start gap-3">
                          <PointIcon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                          <span className="text-sm text-muted-foreground leading-relaxed">{point.text}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default RoleCards
