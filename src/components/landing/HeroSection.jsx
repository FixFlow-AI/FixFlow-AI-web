import { Suspense, lazy } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// Lazy load 3D component for performance
const Hero3DElement = lazy(() => import('./Hero3DElement'))

function HeroSection() {
  const { scrollY } = useScroll()
  
  // Parallax transforms
  const yBg = useTransform(scrollY, [0, 1000], [0, 300])
  const yContent = useTransform(scrollY, [0, 1000], [0, -100])
  const opacity = useTransform(scrollY, [0, 600], [1, 0])
  const yBadges = useTransform(scrollY, [0, 1000], [0, -150])

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* 3D Background */}
      <motion.div 
        style={{ y: yBg, opacity }} 
        className="absolute inset-0 w-full h-full"
      >
        <Suspense fallback={<div className="absolute inset-0 bg-background" />}>
          <Hero3DElement />
        </Suspense>
      </motion.div>

      {/* Hero Content */}
      <motion.div 
        style={{ y: yContent, opacity }}
        className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
        >
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">AI-Powered Project Intelligence</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
        >
          <span className="text-gradient">Turn Client Ideas into</span>
          <br />
          <span className="text-gradient-primary">Execution-Ready Plans</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
        >
          Transform unstructured client briefs into structured project proposals with features, 
          risks, market insights, timelines, and effort estimates — all powered by AI.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link to="/new">
            <Button size="lg" className="glow-effect group">
              Generate Your First Proposal
              <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="outline" size="lg">
              View Demo Dashboard
            </Button>
          </Link>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          style={{ y: yBadges }}
          className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>99.9% Uptime</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span>SOC 2 Compliant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>Enterprise Ready</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 1 }}
        style={{ opacity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2"
        >
          <div className="w-1 h-2 rounded-full bg-muted-foreground/50" />
        </motion.div>
      </motion.div>
    </section>
  )
}

export default HeroSection
