import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeOff, LogIn, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'
import AuthProviderButtons from '@/components/auth/AuthProviderButtons'
import AuthRoleSelector from '@/components/auth/AuthRoleSelector'
import useAuthStore from '@/stores/authStore'
import toast from 'react-hot-toast'
import api from '@/config/api'
import { logger } from '@/lib/logger'
import {
  FREELANCER_GITHUB_ONLY_MESSAGE,
  getDashboardPathForRole,
  getDefaultPlanForRole,
  getRoleProviders,
  normalizeRole,
  ROLE_DETAILS,
} from '@/lib/authRoles'

export default function Login() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const login = useAuthStore((s) => s.login)
  const startOAuthLogin = useAuthStore((s) => s.startOAuthLogin)

  const [role, setRole] = useState(normalizeRole(searchParams.get('role')))
  const [form, setForm] = useState({ email: '', password: '' })
  const [forgotForm, setForgotForm] = useState({ email: '', otp: '', newPassword: '', confirmPassword: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingProvider, setLoadingProvider] = useState('')
  const [isForgotLoading, setIsForgotLoading] = useState(false)
  const [isOtpRequested, setIsOtpRequested] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [errors, setErrors] = useState({})

  const providers = getRoleProviders(role)
  const showEmailForm = providers.includes('email')

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  function handleForgotChange(e) {
    const { name, value } = e.target
    setForgotForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  function validate() {
    const errs = {}
    if (!showEmailForm) errs.provider = FREELANCER_GITHUB_ONLY_MESSAGE
    if (!form.email) errs.email = 'Email is required'
    if (!form.password) errs.password = 'Password is required'
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
      const result = await login({ ...form, role })
      const nextRole = normalizeRole(result.user?.role || role)
      toast.success('Welcome back.')
      navigate(getDashboardPathForRole(nextRole))
    } catch (err) {
      logger.error('Login Failed', err, { email: form.email, role })
      const message = err.response?.data?.error || 'Login failed. Please try again.'
      if (/invalid email or password/i.test(message)) {
        setErrors({ email: 'Email not found or password is incorrect', password: ' ' })
      }
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
        selectedPlan: getDefaultPlanForRole(role),
        flow: 'login',
        returnTo: getDashboardPathForRole(role),
      })
    } catch (err) {
      logger.error('OAuth Redirect Failed', err, { provider, role })
      toast.error(err.response?.data?.error || err.message || `Unable to start ${provider} login.`)
      setLoadingProvider('')
    }
  }

  async function handleRequestOtp() {
    setIsForgotLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password/request', { email: forgotForm.email })
      setIsOtpRequested(true)
      toast.success(data.message || 'OTP sent successfully')
    } catch (err) {
      logger.error('OTP Request Failed', err, { email: forgotForm.email })
      toast.error(err.response?.data?.error || 'Unable to send OTP.')
    } finally {
      setIsForgotLoading(false)
    }
  }

  async function handleResetPassword() {
    if (forgotForm.newPassword !== forgotForm.confirmPassword) {
      setErrors({ confirmPassword: 'Passwords do not match' })
      return
    }

    setIsForgotLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password/verify', {
        email: forgotForm.email,
        otp: forgotForm.otp,
        newPassword: forgotForm.newPassword,
      })
      toast.success(data.message || 'Password updated')
      setShowForgotPassword(false)
      setIsOtpRequested(false)
      setForgotForm({ email: '', otp: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      logger.error('Password Reset OTP Verification Failed', err, { email: forgotForm.email })
      toast.error(err.response?.data?.error || 'OTP verification failed.')
    } finally {
      setIsForgotLoading(false)
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
          <h1 className="text-3xl font-bold text-foreground">Sign in as {ROLE_DETAILS[role].shortLabel}</h1>
          <p className="mt-2 text-muted-foreground">Select your role first so FixFlowAI shows the correct login methods.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.82fr]">
          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <p className="mb-3 text-sm font-medium text-foreground">Select your role</p>
            <AuthRoleSelector value={role} onChange={(nextRole) => { setRole(nextRole); setErrors({}) }} />
          </div>

          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-semibold text-foreground">Login methods</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {role === 'freelancer'
                  ? 'Freelancer accounts require GitHub login.'
                  : 'Use email, Google, or GitHub for this role.'}
              </p>
            </div>

            <AuthProviderButtons
              providers={providers}
              mode="login"
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
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                    <Input id="email" name="email" type="email" placeholder="you@example.com" value={form.email} onChange={handleChange} autoComplete="email" />
                    {errors.email && <p className="mt-1 text-sm text-destructive">{errors.email}</p>}
                  </div>

                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">Password</label>
                    <div className="relative">
                      <Input id="password" name="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={form.password} onChange={handleChange} autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-sm text-destructive">{errors.password}</p>}
                  </div>

                  <Button type="submit" className="w-full" isLoading={isLoading}>
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => setShowForgotPassword((prev) => !prev)}
                  className="mt-4 text-sm font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </>
            ) : (
              <div className="mt-5 rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-muted-foreground">
                {FREELANCER_GITHUB_ONLY_MESSAGE}
              </div>
            )}

            {showEmailForm && showForgotPassword && (
              <div className="mt-5 space-y-4 border-t border-border pt-5">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">Email</label>
                  <Input name="email" type="email" placeholder="you@example.com" value={forgotForm.email} onChange={handleForgotChange} />
                </div>

                {!isOtpRequested ? (
                  <Button type="button" className="w-full" onClick={handleRequestOtp} isLoading={isForgotLoading}>
                    Send OTP
                  </Button>
                ) : (
                  <>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">OTP</label>
                      <Input name="otp" type="text" inputMode="numeric" placeholder="Enter OTP" value={forgotForm.otp} onChange={handleForgotChange} />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">New password</label>
                      <div className="relative">
                        <Input name="newPassword" type={showNewPassword ? 'text' : 'password'} placeholder="New password" value={forgotForm.newPassword} onChange={handleForgotChange} />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-foreground">Confirm password</label>
                      <Input name="confirmPassword" type="password" placeholder="Confirm new password" value={forgotForm.confirmPassword} onChange={handleForgotChange} />
                      {errors.confirmPassword && <p className="mt-1 text-sm text-destructive">{errors.confirmPassword}</p>}
                    </div>
                    <Button type="button" className="w-full" onClick={handleResetPassword} isLoading={isForgotLoading}>
                      Reset password
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link to={`/register?role=${role}`} className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </motion.div>
    </div>
  )
}
