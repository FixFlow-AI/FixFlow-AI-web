import { CheckCircle2 } from 'lucide-react'
import { AUTH_ROLES, ROLE_DETAILS } from '@/lib/authRoles'
import { cn } from '@/lib/utils'

export default function AuthRoleSelector({ value, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3" data-testid="role-selector">
      {AUTH_ROLES.map((role) => {
        const details = ROLE_DETAILS[role]
        const selected = value === role

        return (
          <button
            key={role}
            type="button"
            onClick={() => onChange(role)}
            className={cn(
              'min-h-[9.5rem] rounded-xl border p-4 text-left transition-all',
              'bg-background/30 hover:border-primary/50 hover:bg-muted/30',
              selected ? 'border-primary bg-primary/10 shadow-[0_0_28px_rgba(63,215,255,0.08)]' : 'border-border'
            )}
            data-testid={`role-${role}`}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-sm font-semibold text-foreground">{details.label}</span>
              {selected ? <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> : null}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{details.description}</p>
          </button>
        )
      })}
    </div>
  )
}
