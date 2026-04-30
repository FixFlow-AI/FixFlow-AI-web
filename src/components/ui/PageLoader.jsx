import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

export function PageLoader() {
  const [loadingText, setLoadingText] = useState('Initializing FixFlowAI...')

  useEffect(() => {
    const texts = [
      'Connecting to Neural Net...',
      'Loading Quantum Models...',
      'Synthesizing UI...',
      'Readying FixFlowAI...',
    ]
    let index = 0
    const interval = setInterval(() => {
      index = (index + 1) % texts.length
      setLoadingText(texts[index])
    }, 800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/90 backdrop-blur-md overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-accent/20 rounded-full blur-[80px] pointer-events-none" />

      {/* Main Loader Container */}
      <div className="relative flex flex-col items-center z-10">
        {/* Hexagon / Futuristic Spinner */}
        <div className="relative w-32 h-32 flex items-center justify-center mb-8">
          {/* Outer ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-t-2 border-r-2 border-primary"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
          />
          {/* Inner ring */}
          <motion.div
            className="absolute inset-2 rounded-full border-b-2 border-l-2 border-accent"
            animate={{ rotate: -360 }}
            transition={{ duration: 1.5, ease: 'linear', repeat: Infinity }}
          />
          {/* Core pulse */}
          <motion.div
            className="w-12 h-12 bg-primary/40 rounded-full blur-md"
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity }}
          />
          {/* Core dot */}
          <div className="absolute w-4 h-4 bg-primary rounded-full shadow-[0_0_15px_var(--primary)]" />
        </div>

        {/* Brand Name */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent mb-2"
        >
          FIXFLOWAI
        </motion.h1>

        {/* Loading text sequence */}
        <motion.p
          key={loadingText}
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          className="text-sm font-mono text-muted-foreground tracking-widest uppercase"
        >
          {loadingText}
        </motion.p>

        {/* Progress bar line */}
        <div className="w-64 h-1 bg-muted rounded-full mt-6 overflow-hidden relative">
          <motion.div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-accent"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2, ease: 'easeInOut', repeat: Infinity }}
          />
        </div>
      </div>
    </div>
  )
}
