import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Briefcase, Building2, Code2, Sparkles, Shield, Clock, Zap, Cpu, FileText } from 'lucide-react'

const roles = [
  {
    title: 'Freelancers',
    subtitle: 'Bypass gatekeepers & secure pay.',
    icon: Briefcase,
    color: 'bg-primary/5',
    borderColor: 'hover:border-primary/30',
    iconColor: 'text-primary',
    points: [
      { icon: Sparkles, text: 'Bypass legacy reputation/profile review gatekeeping' },
      { icon: Shield, text: 'Secure automated escrows for every project bid' },
      { icon: Clock, text: 'Co-create proposals and timelines in collaborative space' },
      { icon: Zap, text: 'Autonomously collect payouts upon verified milestone delivery' },
    ],
  },
  {
    title: 'Agencies & Studios',
    subtitle: 'Standardize client intake operations.',
    icon: Building2,
    color: 'bg-emerald-500/5',
    borderColor: 'hover:border-emerald-500/30',
    iconColor: 'text-emerald-500',
    points: [
      { icon: FileText, text: 'Standardize proposals for clients and team members' },
      { icon: Cpu, text: 'Avoid scattered communication across emails and logs' },
      { icon: Shield, text: 'Renegotiate project scopes and timelines under one roof' },
      { icon: Zap, text: 'Secure retainer funding before team starts coding' },
    ],
  },
  {
    title: 'Developers & Consultants',
    subtitle: 'Deliver with absolute payment security.',
    icon: Code2,
    color: 'bg-amber-500/5',
    borderColor: 'hover:border-amber-500/30',
    iconColor: 'text-amber-500',
    points: [
      { icon: Cpu, text: 'Automated verification check loop for completed tasks' },
      { icon: Shield, text: 'Direct client-to-freelancer payment releases (40-50%)' },
      { icon: FileText, text: 'Clear spec alignment with zero invoice collection friction' },
      { icon: Clock, text: 'Client closes issue when verified tasks are approved' },
    ],
  },
]

function RoleCards() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="roles" className="py-24 sm:py-32 bg-muted/10 border-b border-border/60">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
            Tailored Experiences
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Built for{' '}
            <span className="text-gradient-primary">client-service teams.</span>
          </h2>
          <p className="mt-5 text-base text-muted-foreground leading-7">
            Whether you are an independent freelancer, a growing digital studio, or a technical consultant.
          </p>
        </motion.div>

        {/* Role Cards Grid */}
        <div className="grid gap-8 lg:grid-cols-3">
          {roles.map((role, index) => {
            const RoleIcon = role.icon
            return (
              <motion.div
                key={role.title}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className={`relative rounded-xl border border-border bg-card p-8 group ${role.borderColor} transition-all duration-300 hover:shadow-sm`}
              >
                <div className="relative">
                  {/* Icon */}
                  <div className={`mb-6 inline-flex items-center justify-center h-12 w-12 rounded-xl ${role.color} ${role.iconColor} transition-colors`}>
                    <RoleIcon className="h-6 w-6" />
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-bold text-foreground mb-1">{role.title}</h3>
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
