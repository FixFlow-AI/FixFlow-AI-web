import { useRef } from 'react'
import { motion, useScroll, useSpring } from 'framer-motion'
import WaitlistNavbar from '@/components/waitlist/WaitlistNavbar'
import WaitlistHero from '@/components/waitlist/WaitlistHero'
import ProblemSection from '@/components/waitlist/ProblemSection'
import SolutionSection from '@/components/waitlist/SolutionSection'
import RoleCards from '@/components/waitlist/RoleCards'
import WhyJoinSection from '@/components/waitlist/WhyJoinSection'
import WaitlistForm from '@/components/waitlist/WaitlistForm'
import WaitlistFooter from '@/components/waitlist/WaitlistFooter'

function Landing() {
  const containerRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 })

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="cinematic-landing min-h-screen bg-background"
    >
      {/* Scroll Progress Bar */}
      <motion.div
        style={{ scaleX }}
        className="fixed top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-accent to-primary origin-left z-[60]"
      />

      <WaitlistNavbar />
      <main>
        <WaitlistHero />
        <ProblemSection />
        <SolutionSection />
        <RoleCards />
        <WhyJoinSection />
        <WaitlistForm />
      </main>
      <WaitlistFooter />
    </motion.div>
  )
}

export default Landing
