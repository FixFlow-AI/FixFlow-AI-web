import { motion } from 'framer-motion'
import WaitlistNavbar from '@/components/waitlist/WaitlistNavbar'
import WaitlistHero from '@/components/waitlist/WaitlistHero'
import ProblemSection from '@/components/waitlist/ProblemSection'
import SolutionSection from '@/components/waitlist/SolutionSection'
import RoleCards from '@/components/waitlist/RoleCards'
import WhyJoinSection from '@/components/waitlist/WhyJoinSection'
import WaitlistForm from '@/components/waitlist/WaitlistForm'
import WaitlistFooter from '@/components/waitlist/WaitlistFooter'

function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="cinematic-landing min-h-screen bg-background"
    >
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
