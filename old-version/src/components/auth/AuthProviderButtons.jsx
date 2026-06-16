import { Github, Mail, Chrome } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PROVIDER_LABELS } from '@/lib/authRoles'

const icons = {
  email: Mail,
  google: Chrome,
  github: Github,
}

export default function AuthProviderButtons({ providers, mode, onProviderClick, loadingProvider }) {
  return (
    <div className="space-y-3" data-testid="auth-providers">
      {providers.filter((provider) => provider !== 'email').map((provider) => {
        const Icon = icons[provider]
        return (
          <Button
            key={provider}
            type="button"
            variant={provider === 'github' ? 'default' : 'outline'}
            className="w-full"
            onClick={() => onProviderClick(provider)}
            isLoading={loadingProvider === provider}
            data-testid={`${provider}-${mode}`}
          >
            <Icon className="h-4 w-4" />
            Continue with {PROVIDER_LABELS[provider]}
          </Button>
        )
      })}
    </div>
  )
}
