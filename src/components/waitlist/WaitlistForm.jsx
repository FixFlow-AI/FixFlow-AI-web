import { useState, useRef } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { Send, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import axios from 'axios'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.protocol === 'https:'
    ? '/api'
    : 'http://localhost:5000/api')

const VALID_ROLES = ['Freelancer', 'Client', 'Developer']
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Stagger container/item variants
const formContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.2 },
  },
}
const formFieldVariants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
}

function WaitlistForm() {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' })
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start end', 'end start'] })
  const yShift = useTransform(scrollYProgress, [0, 1], [30, -30])

  const [form, setForm] = useState({ username: '', email: '', role: '', comment: '' })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)

  const validate = () => {
    const newErrors = {}
    const trimmedName = form.username.trim()
    if (!trimmedName) newErrors.username = 'Name is required'
    else if (trimmedName.length > 80) newErrors.username = 'Name must be 80 characters or less'

    const trimmedEmail = form.email.trim()
    if (!trimmedEmail) newErrors.email = 'Email is required'
    else if (!EMAIL_REGEX.test(trimmedEmail)) newErrors.email = 'Please enter a valid email'
    else if (trimmedEmail.length > 254) newErrors.email = 'Email must be 254 characters or less'

    if (!form.role) newErrors.role = 'Please select a role'
    else if (!VALID_ROLES.includes(form.role)) newErrors.role = 'Please select a valid role'

    if (form.comment.length > 1000) newErrors.comment = 'Comment must be 1000 characters or less'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
    if (submitResult) setSubmitResult(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLoading) return
    if (!validate()) return

    setIsLoading(true)
    setSubmitResult(null)

    try {
      const { data } = await axios.post(`${API_BASE_URL}/waitlist`, {
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        comment: form.comment.trim(),
      })
      setSubmitResult({
        type: 'success',
        message: data.message || 'Thank you for joining the Fix Flow AI waitlist.',
      })
      if (data.message && !data.message.includes('already')) {
        setForm({ username: '', email: '', role: '', comment: '' })
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Something went wrong. Please try again.'
      setSubmitResult({ type: 'error', message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section id="waitlist-form" className="py-24 sm:py-32 overflow-hidden">
      <motion.div ref={sectionRef} style={{ y: yShift }} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-center mb-12"
          >
            <motion.span
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-primary inline-block"
              initial={{ opacity: 0, letterSpacing: '0.5em' }}
              animate={isInView ? { opacity: 1, letterSpacing: '0.22em' } : {}}
              transition={{ duration: 0.8, delay: 0.1 }}
            >
              Get Started
            </motion.span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Join the{' '}<span className="text-gradient-primary">Waitlist</span>
            </h2>
            <motion.div
              className="mt-3 mx-auto h-1 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent"
              initial={{ width: 0, opacity: 0 }}
              animate={isInView ? { width: 120, opacity: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.3 }}
            />
            <p className="mt-5 text-lg text-muted-foreground leading-8">
              Be among the first to experience Fix Flow AI. Tell us about yourself and what you are looking for.
            </p>
          </motion.div>

          {/* Form Card with staggered field entrance */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="landing-panel-strong rounded-2xl p-8 sm:p-10 relative overflow-hidden"
          >
            {/* Ambient glow behind form */}
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-primary/5 blur-3xl pointer-events-none" />

            <motion.form
              onSubmit={handleSubmit}
              noValidate
              variants={formContainerVariants}
              initial="hidden"
              animate={isInView ? 'visible' : 'hidden'}
              className="space-y-6 relative"
            >
              {/* Username */}
              <motion.div variants={formFieldVariants}>
                <label htmlFor="waitlist-username" className="block text-sm font-medium text-foreground mb-2">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="waitlist-username" name="username" type="text" placeholder="Enter your name"
                  value={form.username} onChange={handleChange} maxLength={80}
                  aria-invalid={!!errors.username}
                  aria-describedby={errors.username ? 'username-error' : undefined}
                  className={cn(errors.username && 'border-destructive focus:ring-destructive/40')}
                />
                {errors.username && (
                  <motion.p id="username-error" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />{errors.username}
                  </motion.p>
                )}
              </motion.div>

              {/* Email */}
              <motion.div variants={formFieldVariants}>
                <label htmlFor="waitlist-email" className="block text-sm font-medium text-foreground mb-2">
                  Email <span className="text-destructive">*</span>
                </label>
                <Input
                  id="waitlist-email" name="email" type="email" placeholder="Enter your email"
                  value={form.email} onChange={handleChange} maxLength={254}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className={cn(errors.email && 'border-destructive focus:ring-destructive/40')}
                />
                {errors.email && (
                  <motion.p id="email-error" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />{errors.email}
                  </motion.p>
                )}
              </motion.div>

              {/* Role */}
              <motion.div variants={formFieldVariants}>
                <label htmlFor="waitlist-role" className="block text-sm font-medium text-foreground mb-2">
                  Your Role <span className="text-destructive">*</span>
                </label>
                <select
                  id="waitlist-role" name="role" value={form.role} onChange={handleChange}
                  aria-invalid={!!errors.role}
                  aria-describedby={errors.role ? 'role-error' : undefined}
                  className={cn(
                    'flex h-10 w-full rounded-xl border border-border bg-muted/70 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors appearance-none cursor-pointer',
                    !form.role && 'text-muted-foreground',
                    errors.role && 'border-destructive focus:ring-destructive/40'
                  )}
                >
                  <option value="" disabled>Select your role</option>
                  {VALID_ROLES.map((role) => (<option key={role} value={role}>{role}</option>))}
                </select>
                {errors.role && (
                  <motion.p id="role-error" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                    className="mt-1.5 text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />{errors.role}
                  </motion.p>
                )}
              </motion.div>

              {/* Comment */}
              <motion.div variants={formFieldVariants}>
                <label htmlFor="waitlist-comment" className="block text-sm font-medium text-foreground mb-2">
                  Your Thoughts <span className="text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="waitlist-comment" name="comment"
                  placeholder="Tell us what you are looking for, why you are interested, or any suggestion you have..."
                  value={form.comment} onChange={handleChange} maxLength={1000} rows={4}
                  aria-invalid={!!errors.comment}
                  aria-describedby={errors.comment ? 'comment-error' : undefined}
                  className={cn(errors.comment && 'border-destructive focus:ring-destructive/40')}
                />
                <div className="flex justify-between mt-1.5">
                  {errors.comment ? (
                    <motion.p id="comment-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />{errors.comment}
                    </motion.p>
                  ) : <span />}
                  <span className="text-xs text-muted-foreground">{form.comment.length}/1000</span>
                </div>
              </motion.div>

              {/* Submit */}
              <motion.div variants={formFieldVariants}>
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Button type="submit" size="lg" isLoading={isLoading} disabled={isLoading} className="w-full glow-effect">
                    {!isLoading && <Send className="h-4 w-4" />}
                    {isLoading ? 'Submitting...' : 'Join Waitlist'}
                  </Button>
                </motion.div>
              </motion.div>

              {/* Result Message */}
              {submitResult && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className={cn(
                    'rounded-xl p-4 flex items-start gap-3 text-sm',
                    submitResult.type === 'success'
                      ? 'landing-success-callout'
                      : 'bg-destructive/10 border border-destructive/30 text-destructive'
                  )}
                  role="alert"
                >
                  {submitResult.type === 'success' ? (
                    <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 0.6 }}>
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                    </motion.div>
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  )}
                  <p>{submitResult.message}</p>
                  {submitResult.type === 'success' && (
                    <motion.div
                      className="ml-auto"
                      animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                    >
                      <Sparkles className="h-5 w-5 text-primary" />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </motion.form>
          </motion.div>
        </div>
      </motion.div>
    </section>
  )
}

export default WaitlistForm
