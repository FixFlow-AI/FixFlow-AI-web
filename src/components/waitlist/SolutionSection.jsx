import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { CheckCircle2, UserCheck, ShieldCheck } from 'lucide-react'

function SolutionSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-100px' })

  return (
    <section id="solutions" className="py-24 sm:py-32 overflow-hidden border-b border-border/60">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-20"
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary inline-block font-semibold">
            How It Works
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Automating the client{' '}
            <span className="text-gradient-primary">lifecycle.</span>
          </h2>
          <p className="mt-5 text-base text-muted-foreground leading-7">
            From initial brief parsing to scope approvals and secure retainer collections. FixFlow AI handles client intake autonomously.
          </p>
        </motion.div>

        {/* Feature Row 1: Autonomous Onboarding */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-24">
          {/* Left: Text Description */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 flex flex-col items-start"
          >
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary mb-6">
              <UserCheck className="h-5 w-5" />
            </div>
            <h3 className="text-2xl font-bold text-foreground tracking-tight sm:text-3xl">
              Autonomous Onboarding
            </h3>
            <p className="mt-4 text-base text-muted-foreground leading-7">
              Once you paste the brief, FixFlow AI sets up a branded Client Portal. The client is guided through requirement confirmations, file uploads, and specific details without back-and-forth email threads.
            </p>
            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-2.5 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-1 shrink-0" />
                <span>Custom wizard guides client through project assets</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-1 shrink-0" />
                <span>Smart file drop box accepts briefs, design docs, and specs</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-1 shrink-0" />
                <span>Keeps client informed of setup progress in real time</span>
              </li>
            </ul>
          </motion.div>

          {/* Right: iPad Frame Onboarding Video */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, x: 40 }}
            animate={isInView ? { opacity: 1, scale: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7"
          >
            <div className="relative rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="aspect-[4/3] bg-muted/20 overflow-hidden">
                <video
                  src="/video/onboarding-portal.mp4"
                  poster="/landing-page/onboarding-portal.png"
                  muted
                  playsInline
                  autoPlay
                  loop
                  className="w-full h-full object-cover scale-[1.08] translate-x-[2.5%] translate-y-[2.5%]"
                />
              </div>
            </div>
          </motion.div>
        </div>

        {/* Feature Row 2: Secure Integrated Payments */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left: Laptop Frame Payment Video */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, x: -40 }}
            animate={isInView ? { opacity: 1, scale: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 order-2 lg:order-1"
          >
            <div className="relative rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              {/* Browser Header Bar */}
              <div className="flex items-center gap-1.5 px-4 py-3 bg-muted/40 border-b border-border/60">
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <div className="ml-4 h-4 w-44 rounded bg-border/40 font-mono text-[9px] flex items-center px-2 text-muted-foreground/60">
                  checkout.fixflowai.xyz
                </div>
              </div>
              <div className="aspect-[16/10] bg-muted/20 overflow-hidden">
                <video
                  src="/video/payment-checkout.mp4"
                  poster="/landing-page/payment-checkout.png"
                  muted
                  playsInline
                  autoPlay
                  loop
                  className="w-full h-full object-cover scale-[1.08] translate-x-[2.5%] translate-y-[2.5%]"
                />
              </div>
            </div>
          </motion.div>

          {/* Right: Text Description */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 order-1 lg:order-2 flex flex-col items-start"
          >
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-lg bg-primary/10 text-primary mb-6">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-2xl font-bold text-foreground tracking-tight sm:text-3xl">
              Secure Integrated Payments
            </h3>
            <p className="mt-4 text-base text-muted-foreground leading-7">
              Never start work without a deposit again. FixFlow AI generates secure, itemized billing schedules tied directly to the proposal scope. Clients review, sign, and pay retainers instantly via Razorpay or Stripe.
            </p>
            <ul className="mt-6 space-y-3">
              <li className="flex items-start gap-2.5 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-1 shrink-0" />
                <span>Integrated Razorpay & Stripe gateway collection</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-1 shrink-0" />
                <span>Itemized scope items mapped to payment schedules</span>
              </li>
              <li className="flex items-start gap-2.5 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-1 shrink-0" />
                <span>Instant webhooks activate project repositories upon deposit</span>
              </li>
            </ul>
          </motion.div>
        </div>

      </div>
    </section>
  )
}

export default SolutionSection
