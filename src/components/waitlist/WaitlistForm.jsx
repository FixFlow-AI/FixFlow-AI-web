import { useState, useRef } from 'react'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Send, CheckCircle2, AlertCircle, Sparkles, X, Mail } from 'lucide-react'
import axios from 'axios'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

const WAITLIST_API_URL =
  import.meta.env.VITE_WAITLIST_API_URL ||
  import.meta.env.VITE_API_URL ||
  '/api/waitlist'

const CONTACT_API_URL =
  import.meta.env.VITE_API_URL 
    ? `${import.meta.env.VITE_API_URL}/contact`
    : '/api/contact'

const VALID_ROLES = ['Freelancer', 'Client', 'Developer']
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function WaitlistForm() {
  const sectionRef = useRef(null)
  const isInView = useInView(sectionRef, { once: true, margin: '-80px' })

  // Waitlist Form State
  const [form, setForm] = useState({ username: '', email: '', role: '', comment: '' })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [submitResult, setSubmitResult] = useState(null)

  // Contact Modal State
  const [isContactOpen, setIsContactOpen] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' })
  const [contactErrors, setContactErrors] = useState({})
  const [isContactLoading, setIsContactLoading] = useState(false)
  const [contactResult, setContactResult] = useState(null)

  // Waitlist Validation
  const validateWaitlist = () => {
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

  // Contact Form Validation
  const validateContact = () => {
    const newErrors = {}
    const trimmedName = contactForm.name.trim()
    if (!trimmedName) newErrors.name = 'Name is required'
    else if (trimmedName.length > 80) newErrors.name = 'Name must be 80 characters or less'

    const trimmedEmail = contactForm.email.trim()
    if (!trimmedEmail) newErrors.email = 'Email is required'
    else if (!EMAIL_REGEX.test(trimmedEmail)) newErrors.email = 'Please enter a valid email'
    else if (trimmedEmail.length > 254) newErrors.email = 'Email must be 254 characters or less'

    const trimmedMessage = contactForm.message.trim()
    if (!trimmedMessage) newErrors.message = 'Message is required'
    else if (trimmedMessage.length < 10) newErrors.message = 'Message must be at least 10 characters'
    else if (trimmedMessage.length > 1500) newErrors.message = 'Message must be 1500 characters or less'

    setContactErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
    if (submitResult) setSubmitResult(null)
  }

  const handleContactChange = (e) => {
    const { name, value } = e.target
    setContactForm((prev) => ({ ...prev, [name]: value }))
    if (contactErrors[name]) setContactErrors((prev) => ({ ...prev, [name]: undefined }))
    if (contactResult) setContactResult(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isLoading) return
    if (!validateWaitlist()) return

    setIsLoading(true)
    setSubmitResult(null)

    try {
      const { data } = await axios.post(WAITLIST_API_URL, {
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        comment: form.comment.trim(),
      })
      setSubmitResult({
        type: 'success',
        message: data.message || 'Thank you for joining the FixFlow AI waitlist.',
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

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    if (isContactLoading) return
    if (!validateContact()) return

    setIsContactLoading(true)
    setContactResult(null)

    try {
      const { data } = await axios.post(CONTACT_API_URL, {
        name: contactForm.name.trim(),
        email: contactForm.email.trim().toLowerCase(),
        message: contactForm.message.trim(),
      })
      setContactResult({
        type: 'success',
        message: data.message || 'Thank you. Your inquiry has been submitted.',
      })
      setContactForm({ name: '', email: '', message: '' })
    } catch (error) {
      const message = error.response?.data?.message || 'Failed to submit inquiry. Please try again.'
      setContactResult({ type: 'error', message })
    } finally {
      setIsContactLoading(false)
    }
  }

  return (
    <section id="waitlist-form" ref={sectionRef} className="py-24 sm:py-32 overflow-hidden bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Section Header */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="text-center mb-12"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
              Get Started
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Request{' '}<span className="text-gradient-primary">Beta Access</span>
            </h2>
            <p className="mt-4 text-base text-muted-foreground">
              Be among the first to experience the proposal operating system. Early cohorts are invited weekly.
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-border bg-card p-8 sm:p-10 shadow-sm relative"
          >
            <form onSubmit={handleSubmit} noValidate className="space-y-6 relative">
              {/* Username */}
              <div>
                <label htmlFor="waitlist-username" className="block text-xs font-mono uppercase tracking-[0.1em] text-foreground mb-2">
                  Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="waitlist-username" name="username" type="text" placeholder="Enter your name"
                  value={form.username} onChange={handleChange} maxLength={80}
                  aria-invalid={!!errors.username}
                  className={cn(errors.username && 'border-destructive focus:ring-destructive/40')}
                />
                {errors.username && (
                  <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />{errors.username}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label htmlFor="waitlist-email" className="block text-xs font-mono uppercase tracking-[0.1em] text-foreground mb-2">
                  Email <span className="text-destructive">*</span>
                </label>
                <Input
                  id="waitlist-email" name="email" type="email" placeholder="Enter your email"
                  value={form.email} onChange={handleChange} maxLength={254}
                  aria-invalid={!!errors.email}
                  className={cn(errors.email && 'border-destructive focus:ring-destructive/40')}
                />
                {errors.email && (
                  <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />{errors.email}
                  </p>
                )}
              </div>

              {/* Role */}
              <div>
                <label htmlFor="waitlist-role" className="block text-xs font-mono uppercase tracking-[0.1em] text-foreground mb-2">
                  Your Role <span className="text-destructive">*</span>
                </label>
                <select
                  id="waitlist-role" name="role" value={form.role} onChange={handleChange}
                  aria-invalid={!!errors.role}
                  className={cn(
                    'flex h-10 w-full rounded-xl border border-border bg-muted/20 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors appearance-none cursor-pointer',
                    !form.role && 'text-muted-foreground',
                    errors.role && 'border-destructive focus:ring-destructive/40'
                  )}
                >
                  <option value="" disabled>Select your role</option>
                  {VALID_ROLES.map((role) => (<option key={role} value={role}>{role}</option>))}
                </select>
                {errors.role && (
                  <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />{errors.role}
                  </p>
                )}
              </div>

              {/* Comment */}
              <div>
                <label htmlFor="waitlist-comment" className="block text-xs font-mono uppercase tracking-[0.1em] text-foreground mb-2">
                  What kind of proposals do you create? <span className="text-muted-foreground">(optional)</span>
                </label>
                <Textarea
                  id="waitlist-comment" name="comment"
                  placeholder="e.g. Agency software proposals, freelance design scopes, consultancy quotes..."
                  value={form.comment} onChange={handleChange} maxLength={1000} rows={4}
                  aria-invalid={!!errors.comment}
                  className={cn(errors.comment && 'border-destructive focus:ring-destructive/40')}
                />
                <div className="flex justify-between mt-1.5">
                  {errors.comment && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />{errors.comment}
                    </p>
                  )}
                  <span className="text-[10px] font-mono text-muted-foreground ml-auto">{form.comment.length}/1000</span>
                </div>
              </div>

              {/* Submit */}
              <div>
                <Button type="submit" size="lg" isLoading={isLoading} disabled={isLoading} className="w-full bg-primary text-primary-foreground">
                  {!isLoading && <Send className="h-4 w-4 mr-2" />}
                  {isLoading ? 'Requesting...' : 'Request Beta Access'}
                </Button>
              </div>

              {/* Result Message */}
              {submitResult && (
                <div
                  className={cn(
                    'rounded-lg p-4 flex items-start gap-3 text-sm border',
                    submitResult.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-destructive/5 border-destructive/20 text-destructive'
                  )}
                  role="alert"
                >
                  {submitResult.type === 'success' ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  )}
                  <p className="text-xs leading-relaxed">{submitResult.message}</p>
                </div>
              )}
            </form>
          </motion.div>

          {/* Contact Us Footer Callout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={isInView ? { opacity: 1 } : {}}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-12 text-center"
          >
            <p className="text-sm text-muted-foreground">
              Have questions about integrations or enterprise setups?{' '}
              <button
                type="button"
                onClick={() => setIsContactOpen(true)}
                className="font-semibold text-primary hover:underline underline-offset-4 focus:outline-none"
              >
                Contact Us
              </button>
            </p>
          </motion.div>
        </div>
      </div>

      {/* Contact Us Modal Overlay */}
      <AnimatePresence>
        {isContactOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 sm:p-8 shadow-lg"
              role="dialog"
              aria-modal="true"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setIsContactOpen(false)
                  setContactResult(null)
                }}
                className="absolute top-4 right-4 p-1.5 text-muted-foreground hover:text-foreground rounded-lg transition-colors border border-transparent hover:border-border"
                aria-label="Close contact dialog"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <Mail className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-foreground">Contact Support & Sales</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Submit your inquiries, suggestions, or roadmap questions directly to our product operations team.
              </p>

              <form onSubmit={handleContactSubmit} className="space-y-4">
                {/* Name */}
                <div>
                  <label htmlFor="contact-name" className="block text-xs font-mono uppercase tracking-[0.1em] text-foreground mb-2">
                    Name <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="contact-name" name="name" type="text" placeholder="Your name"
                    value={contactForm.name} onChange={handleContactChange} maxLength={80}
                    className={cn(contactErrors.name && 'border-destructive')}
                  />
                  {contactErrors.name && (
                    <p className="mt-1 text-xs text-destructive">{contactErrors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label htmlFor="contact-email" className="block text-xs font-mono uppercase tracking-[0.1em] text-foreground mb-2">
                    Email <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="contact-email" name="email" type="email" placeholder="hello@yourcompany.com"
                    value={contactForm.email} onChange={handleContactChange} maxLength={254}
                    className={cn(contactErrors.email && 'border-destructive')}
                  />
                  {contactErrors.email && (
                    <p className="mt-1 text-xs text-destructive">{contactErrors.email}</p>
                  )}
                </div>

                {/* Message */}
                <div>
                  <label htmlFor="contact-message" className="block text-xs font-mono uppercase tracking-[0.1em] text-foreground mb-2">
                    Message <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    id="contact-message" name="message" placeholder="Describe your inquiry..."
                    value={contactForm.message} onChange={handleContactChange} maxLength={1500} rows={4}
                    className={cn(contactErrors.message && 'border-destructive')}
                  />
                  <div className="flex justify-between mt-1">
                    {contactErrors.message && (
                      <p className="text-xs text-destructive">{contactErrors.message}</p>
                    )}
                    <span className="text-[10px] font-mono text-muted-foreground ml-auto">{contactForm.message.length}/1500</span>
                  </div>
                </div>

                {/* Submit button */}
                <div className="pt-2">
                  <Button type="submit" isLoading={isContactLoading} disabled={isContactLoading} className="w-full bg-primary text-primary-foreground">
                    {!isContactLoading && <Send className="h-4 w-4 mr-2" />}
                    {isContactLoading ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>

                {/* Result Notification */}
                {contactResult && (
                  <div
                    className={cn(
                      'rounded-lg p-4 flex items-start gap-3 text-sm border mt-4',
                      contactResult.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-destructive/5 border-destructive/20 text-destructive'
                    )}
                  >
                    {contactResult.type === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    )}
                    <p className="text-xs">{contactResult.message}</p>
                  </div>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  )
}

export default WaitlistForm
