import { motion } from 'framer-motion'
import Navbar from '@/components/layout/Navbar'
import HeroSection from '@/components/landing/HeroSection'
import FeaturesSection from '@/components/landing/FeaturesSection'
import HowItWorks from '@/components/landing/HowItWorks'
import BenefitsGrid from '@/components/landing/BenefitsGrid'
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
        <FeaturesSection />
        <HowItWorks />
        <BenefitsGrid />
      </main>
      <Footer />
    </motion.div>
  )
}

export default Landing
