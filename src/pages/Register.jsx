import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Sparkles, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'
import AuthProviderButtons from '@/components/auth/AuthProviderButtons'
import AuthRoleSelector from '@/components/auth/AuthRoleSelector'
import useAuthStore from '@/stores/authStore'
import toast from 'react-hot-toast'
import {
  FREELANCER_GITHUB_ONLY_MESSAGE,
  getDashboardPathForRole,
  getDefaultPlanForRole,
  getRolePlans,
  getRoleProviders,
  isPlanAllowedForRole,
  normalizeRole,
  ROLE_DETAILS,
} from '@/lib/authRoles'

export default function Register() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const register = useAuthStore((s) => s.register)
  const startOAuthLogin = useAuthStore((s) => s.startOAuthLogin)

  const initialRole = normalizeRole(searchParams.get('role'))
  const [role, setRole] = useState(initialRole)
  const [selectedPlan, setSelectedPlan] = useState(() => {
    const requestedPlan = searchParams.get('plan')
    return requestedPlan && isPlanAllowedForRole(initialRole, requestedPlan)
      ? requestedPlan
      : getDefaultPlanForRole(initialRole)
  })
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState('')
  const [errors, setErrors] = useState({})

  const plans = useMemo(() => getRolePlans(role), [role])
  const providers = useMemo(() => getRoleProviders(role), [role])
  const showEmailForm = providers.includes('email')

  useEffect(() => {
    if (!isPlanAllowedForRole(role, selectedPlan)) {
      setSelectedPlan(getDefaultPlanForRole(role))
    }
    setErrors({})
  }, [role, selectedPlan])

  function handleRoleChange(nextRole) {
    setRole(nextRole)
    setSelectedPlan(getDefaultPlanForRole(nextRole))
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  function validate() {
    const errs = {}
    if (!isPlanAllowedForRole(role, selectedPlan)) errs.selectedPlan = 'Choose a plan that matches the selected role.'
    if (!showEmailForm) errs.provider = FREELANCER_GITHUB_ONLY_MESSAGE
    if (!form.name || form.name.length < 2) errs.name = 'Name must be at least 2 characters'
    if (!form.email) errs.email = 'Email is required'
    if (!form.password || form.password.length < 8) errs.password = 'Password must be at least 8 characters'
    else if (!/[A-Z]/.test(form.password)) errs.password = 'Password must contain an uppercase letter'
    else if (!/[0-9]/.test(form.password)) errs.password = 'Password must contain a number'
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      if (errs.provider) toast.error(errs.provider)
      return
    }

    setIsLoading(true)
    try {
      await register({
        name: form.name,
        email: form.email,
        password: form.password,
        role,
        selectedPlan,
        defaultEntryMode: 'individual',
        teamPlanPreference: selectedPlan === 'solo' ? 'free' : selectedPlan,
      })
      toast.success('Account created.')
      navigate(getDashboardPathForRole(role))
    } catch (err) {
      const message = err.response?.data?.error || 'Registration failed. Please try again.'
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  async function handleProviderClick(provider) {
    if (provider !== 'github' && role === 'freelancer') {
      toast.error(FREELANCER_GITHUB_ONLY_MESSAGE)
      return
    }

    setLoadingProvider(provider)
    try {
      await startOAuthLogin({
        provider,
        role,
        selectedPlan,
        flow: 'signup',
        returnTo: getDashboardPathForRole(role),
      })
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || `Unable to start ${provider} signup.`)
      setLoadingProvider('')
    }
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="fixed right-4 top-4 z-40 sm:right-6 sm:top-6">
        <ThemeSwitcher compact />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto w-full max-w-5xl"
      >
        <div className="mb-8 text-center">
          <Link to="/" className="mb-6 inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">FixFlowAI</span>
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Create your {ROLE_DETAILS[role].shortLabel} account</h1>
          <p className="mt-2 text-muted-foreground">Choose a role first. Plans and sign-up methods update instantly.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="mb-5">
              <p className="mb-3 text-sm font-medium text-foreground">Select your role</p>
              <AuthRoleSelector value={role} onChange={handleRoleChange} />
            </div>

            <div>
              <label htmlFor="selectedPlan" className="mb-2 block text-sm font-medium text-foreground">
                Team / Pricing Plan
              </label>
              <select
                id="selectedPlan"
                name="selectedPlan"
                value={selectedPlan}
                onChange={(event) => setSelectedPlan(event.target.value)}
                className="h-11 w-full rounded-lg border border-border bg-background/60 px-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                data-testid="plan-select"
              >
                {plans.map((plan) => (
                  <option key={plan.value} value={plan.value}>
                    {plan.label} - {plan.detail}
                  </option>
                ))}
              </select>
              {errors.selectedPlan && <p className="mt-1 text-sm text-destructive">{errors.selectedPlan}</p>}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-foreground">Sign up methods</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {role === 'freelancer'
                  ? 'Freelancer credibility is tied to GitHub, so GitHub signup is required.'
                  : 'Use email, Google, or GitHub for this role.'}
              </p>
            </div>

            <AuthProviderButtons
              providers={providers}
              mode="signup"
              onProviderClick={handleProviderClick}
              loadingProvider={loadingProvider}
            />

            {showEmailForm ? (
              <>
                <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  <span>or email</span>
                  <span className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">Full name</label>
                    <Input id="name" name="name" type="text" placeholder="Jane Developer" value={form.name} onChange={handleChange} autoComplete="name" />
                    {errors.name && <p className="mt-1 text-sm text-destructive">{errors.name}</p>}
                  </div>

                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                    <Input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} autoComplete="email" />
                    {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
                    <div className="relative">
                      <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={handleChange} autoComplete="new-password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">Min 8 characters, 1 uppercase, 1 number</p>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-foreground">Confirm password</label>
                    <Input id="confirmPassword" name="confirmPassword" type="password" placeholder="••••••••" value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" />
                    {errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>}
                  </div>

                  <Button type="submit" className="w-full" isLoading={isLoading}>
                    <UserPlus className="h-4 w-4" />
                    Create account
                  </Button>
                </form>
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-muted-foreground">
                {FREELANCER_GITHUB_ONLY_MESSAGE}
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to={`/login?role=${role}`} className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
