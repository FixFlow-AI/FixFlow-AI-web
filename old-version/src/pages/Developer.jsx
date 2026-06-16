import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Code2, GitBranch, Layers3, PlusCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import useAuthStore from '@/stores/authStore'

const developerCards = [
  {
    title: 'Project workspace',
    detail: 'Track active delivery work, proposal context, and team collaboration from one place.',
    icon: Layers3,
  },
  {
    title: 'Build pipeline',
    detail: 'Use proposal intelligence and workspace roles to keep technical delivery aligned.',
    icon: GitBranch,
  },
  {
    title: 'Team collaboration',
    detail: 'Join client or internal teams with clean handoffs, comments, and permissions.',
    icon: Users,
  },
]

export default function Developer() {
  const user = useAuthStore((state) => state.user)

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-bold"
          >
            Developer Dashboard
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-1 text-muted-foreground"
          >
            Welcome{user?.name ? `, ${user.name}` : ''}. Collaborate, build, and join delivery teams with structured project context.
          </motion.p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/workspace">
            <Button variant="outline">
              <Users className="h-4 w-4" />
              Open workspace
            </Button>
          </Link>
          <Link to="/new">
            <Button className="glow-effect">
              <PlusCircle className="h-4 w-4" />
              Start proposal
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.78fr]">
        <section className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <Code2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Developer operating surface</h2>
              <p className="text-sm text-muted-foreground">A focused entrypoint for technical contributors.</p>
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {developerCards.map((card) => (
              <div key={card.title} className="rounded-xl border border-border bg-background/30 p-4">
                <card.icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{card.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <aside className="glass-card rounded-2xl p-6">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Account</p>
          <h2 className="mt-2 text-xl font-semibold">Developer profile</h2>
          <div className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4 rounded-lg bg-background/30 px-3 py-2">
              <span className="text-muted-foreground">Role</span>
              <span className="font-medium capitalize">{user?.role || 'developer'}</span>
            </div>
            <div className="flex justify-between gap-4 rounded-lg bg-background/30 px-3 py-2">
              <span className="text-muted-foreground">Plan</span>
              <span className="font-medium capitalize">{user?.selectedPlan || user?.plan || 'free'}</span>
            </div>
            <div className="flex justify-between gap-4 rounded-lg bg-background/30 px-3 py-2">
              <span className="text-muted-foreground">Provider</span>
              <span className="font-medium capitalize">{user?.authProvider || 'email'}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
