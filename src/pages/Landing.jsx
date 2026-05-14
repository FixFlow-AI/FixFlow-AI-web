import { motion } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import HeroSection from '@/components/landing/HeroSection'
import RolePathways from '@/components/landing/RolePathways'
import BriefIntelligence from '@/components/landing/BriefIntelligence'
import ProjectsTimeline from '@/components/landing/ProjectsTimeline'
import TechnicalSchematic from '@/components/landing/TechnicalSchematic'
import AudienceParallax from '@/components/landing/AudienceParallax'
import MasonryVanguard from '@/components/landing/MasonryVanguard'
import FuturePlansSplit from '@/components/landing/FuturePlansSplit'
import Footer from '@/components/landing/Footer'

function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="cinematic-landing min-h-screen bg-background"
    >
      <Navbar />
      <main>
        <HeroSection />
        <RolePathways />
        <BriefIntelligence />
        <ProjectsTimeline />
        <TechnicalSchematic />
        <AudienceParallax />
        <MasonryVanguard />
        <FuturePlansSplit />
      </main>
      <Footer />
    </motion.div>
  )
}

export default Landing
