import { motion } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import HeroSection from '@/components/landing/HeroSection'
import ProjectsTimeline from '@/components/landing/ProjectsTimeline'
import TechnicalSchematic from '@/components/landing/TechnicalSchematic'
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
      className="min-h-screen bg-background"
    >
      <Navbar />
      <main>
        <HeroSection />
        <ProjectsTimeline />
        <TechnicalSchematic />
        <MasonryVanguard />
        <FuturePlansSplit />
      </main>
      <Footer />
    </motion.div>
  )
}

export default Landing
