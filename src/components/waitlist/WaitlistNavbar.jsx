import { useState } from 'react'
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import { Sparkles, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import ThemeSwitcher from '@/components/ui/ThemeSwitcher'
import { cn } from '@/lib/utils'

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Why Fix Flow AI', href: '#problems' },
  { label: 'For Users', href: '#roles' },
  { label: 'How It Works', href: '#solutions' },
  { label: 'Join Waitlist', href: '#waitlist-form' },
]

function WaitlistNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hasScrolled, setHasScrolled] = useState(false)
  const { scrollY } = useScroll()

  // Dynamic backdrop blur and background opacity on scroll
  const navBg = useTransform(scrollY, [0, 120], [0, 0.85])
  const navBlur = useTransform(scrollY, [0, 120], [12, 24])
  const navShadow = useTransform(scrollY, [0, 120], [0, 0.4])

  useMotionValueEvent(scrollY, 'change', (latest) => {
    setHasScrolled(latest > 50)
  })

  const handleAnchorClick = (e, href) => {
    if (href.startsWith('#')) {
      e.preventDefault()
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        setIsMobileMenuOpen(false)
      }
    }
  }

  return (
    <motion.header
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <motion.nav
          style={{
            backdropFilter: useTransform(navBlur, (v) => `blur(${v}px)`),
            WebkitBackdropFilter: useTransform(navBlur, (v) => `blur(${v}px)`),
          }}
          className={cn(
            'rounded-2xl border px-6 py-3 transition-colors duration-500',
            hasScrolled
              ? 'border-primary/15 bg-card/85 shadow-[0_18px_60px_rgba(0,0,0,0.36)]'
              : 'border-primary/10 bg-card/40 shadow-[0_18px_60px_rgba(0,0,0,0.18)]'
          )}
        >
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a
              href="#home"
              onClick={(e) => handleAnchorClick(e, '#home')}
              className="flex items-center gap-2 group"
            >
              <motion.div
                className="relative"
                whileHover={{ scale: 1.15, rotate: 12 }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
              >
                <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full group-hover:bg-primary/50 transition-colors" />
                <Sparkles className="h-8 w-8 text-primary relative" />
              </motion.div>
              <span className="text-xl font-bold text-gradient">FixFlowAI</span>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-7">
              {navLinks.map((link, index) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground relative"
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.06, duration: 0.4 }}
                  whileHover={{ y: -2 }}
                >
                  {link.label}
                  <motion.span
                    className="absolute -bottom-1 left-0 right-0 h-px bg-primary"
                    initial={{ scaleX: 0 }}
                    whileHover={{ scaleX: 1 }}
                    transition={{ duration: 0.25 }}
                  />
                </motion.a>
              ))}
            </div>

            {/* Right Side */}
            <div className="hidden lg:flex items-center gap-3">
              <ThemeSwitcher compact />
              <motion.a
                href="#waitlist-form"
                onClick={(e) => handleAnchorClick(e, '#waitlist-form')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button size="sm" className="glow-effect">
                  Join Waitlist
                </Button>
              </motion.a>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex lg:hidden items-center gap-2">
              <ThemeSwitcher compact />
              <motion.button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Toggle navigation menu"
                whileTap={{ scale: 0.9 }}
              >
                <motion.div
                  animate={{ rotate: isMobileMenuOpen ? 90 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </motion.div>
              </motion.button>
            </div>
          </div>

          {/* Mobile Menu */}
          <motion.div
            initial={false}
            animate={{
              height: isMobileMenuOpen ? 'auto' : 0,
              opacity: isMobileMenuOpen ? 1 : 0,
            }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden overflow-hidden"
          >
            <div className="flex flex-col gap-2 pt-4 mt-4 border-t border-border">
              {navLinks.map((link, index) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                  initial={{ opacity: 0, x: -20 }}
                  animate={isMobileMenuOpen ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                >
                  {link.label}
                </motion.a>
              ))}
              <div className="mt-2 pt-2 border-t border-border">
                <a href="#waitlist-form" onClick={(e) => handleAnchorClick(e, '#waitlist-form')}>
                  <Button size="sm" className="w-full justify-center glow-effect">
                    Join Waitlist
                  </Button>
                </a>
              </div>
            </div>
          </motion.div>
        </motion.nav>
      </div>
    </motion.header>
  )
}

export default WaitlistNavbar
