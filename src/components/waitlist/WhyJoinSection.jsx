import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Check } from 'lucide-react'

const layers = [
  { step: 'Layer 1', title: 'User Interface', desc: 'The client-facing scope document and onboarding portal.' },
  { step: 'Layer 2', title: 'Structured Data', desc: 'Extracted deliverables matrix with timeline scheduling.' },
  { step: 'Layer 3', title: 'Risk & Gap Analysis', desc: 'Alert cards highlighting scope uncertainties and assumptions.' },
  { step: 'Layer 4', title: 'Execution & Trust', desc: 'Contract signature sign-off and secure checkout payments.' },
]

function WhyJoinSection() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section id="intelligence" className="py-24 sm:py-32 overflow-hidden border-b border-border/60 bg-muted/10">
      <div ref={ref} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid gap-16 lg:grid-cols-12 items-center">
          
          {/* Left Column: Exploded View Video Mockup */}
          <motion.div
            initial={{ opacity: 0, x: -40, scale: 0.98 }}
            animate={isInView ? { opacity: 1, x: 0, scale: 1 } : {}}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 w-full"
          >
            {/* Visual background shadows */}
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-tr from-primary/10 to-accent/5 blur-2xl opacity-40 pointer-events-none" />
            
            {/* Browser frame mockup */}
            <div className="relative rounded-xl border border-border bg-card shadow-lg overflow-hidden">
              {/* Browser bar */}
              <div className="flex items-center gap-1.5 px-4 py-3 bg-muted/40 border-b border-border/60">
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <div className="w-2.5 h-2.5 rounded-full bg-border" />
                <span className="ml-4 font-mono text-[9px] text-muted-foreground/60">Engine Architecture</span>
              </div>
              
              {/* Video Player */}
              <div className="aspect-[4/3] relative bg-muted/20">
                <video
                  src="/video/exploded-view.mp4"
                  poster="/landing-page/exploded-view.png"
                  muted
                  playsInline
                  autoPlay
                  loop
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </motion.div>

          {/* Right Column: Engine Details */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 flex flex-col items-start"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">
              The Intelligence Layer
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Under the scoping{' '}
              <span className="text-gradient-primary">engine.</span>
            </h2>
            <p className="mt-5 text-base text-muted-foreground leading-7">
              FixFlow AI processes unstructured specs into four distinct architectural layers, ensuring contract security and project clarity before kickoff.
            </p>

            <div className="mt-8 space-y-6 w-full">
              {layers.map((layer, index) => (
                <div key={layer.step} className="flex gap-4 items-start border-b border-border/60 pb-4 last:border-0 last:pb-0">
                  <div className="shrink-0 flex items-center justify-center font-mono text-[10px] font-semibold h-8 w-14 rounded-md bg-primary/10 text-primary">
                    {layer.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{layer.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{layer.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
          
        </div>
      </div>
    </section>
  )
}

export default WhyJoinSection
