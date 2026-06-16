import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Code2, Github, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'

const roles = [
  {
    role: 'freelancer',
    title: 'Freelancers',
    copy: 'Show GitHub identity, repositories, contribution history, and developer credibility before the first call.',
    cta: 'Join as Freelancer',
    icon: Github,
  },
  {
    role: 'client',
    title: 'Clients',
    copy: 'Hire skilled freelancers and developers with clearer proposal context, delivery signals, and deal-room workflows.',
    cta: 'Hire Talent as Client',
    icon: Users,
  },
  {
    role: 'developer',
    title: 'Developers',
    copy: 'Collaborate on projects, join teams, and keep technical work connected to client-ready delivery plans.',
    cta: 'Join as Developer',
    icon: Code2,
  },
]

export default function RolePathways() {
  return (
    <section id="roles" className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl"
        >
          <h2 className="text-3xl font-bold sm:text-4xl">Built around the three ways work starts</h2>
          <p className="mt-4 text-muted-foreground">
            Each role gets the right authentication path, plan options, and dashboard surface from the first click.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {roles.map((item, index) => (
            <motion.div
              key={item.role}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
              className="landing-panel rounded-2xl p-6"
            >
              <item.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-5 text-2xl font-semibold">{item.title}</h3>
              <p className="mt-3 min-h-[5rem] text-sm leading-6 text-muted-foreground">{item.copy}</p>
              <Link to={`/register?role=${item.role}`} className="mt-6 block">
                <Button className="w-full" variant={item.role === 'freelancer' ? 'default' : 'outline'}>
                  {item.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
