import { useState } from 'react'
import { motion } from 'framer-motion'
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
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="fixed top-0 left-0 right-0 z-50"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        <nav className="glass rounded-2xl border-primary/10 px-6 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a
              href="#home"
              onClick={(e) => handleAnchorClick(e, '#home')}
              className="flex items-center gap-2 group"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-xl rounded-full group-hover:bg-primary/50 transition-colors" />
                <Sparkles className="h-8 w-8 text-primary relative" />
              </div>
              <span className="text-xl font-bold text-gradient">FixFlowAI</span>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Right Side */}
            <div className="hidden lg:flex items-center gap-3">
              <ThemeSwitcher compact />
              <a href="#waitlist-form" onClick={(e) => handleAnchorClick(e, '#waitlist-form')}>
                <Button size="sm" className="glow-effect">
                  Join Waitlist
                </Button>
              </a>
            </div>

            {/* Mobile Menu Button */}
            <div className="flex lg:hidden items-center gap-2">
              <ThemeSwitcher compact />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Menu */}
          <div
            className={cn(
              'lg:hidden overflow-hidden transition-all duration-300',
              isMobileMenuOpen ? 'max-h-80 mt-4' : 'max-h-0'
            )}
          >
            <div className="flex flex-col gap-2 pt-4 border-t border-border">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="mt-2 pt-2 border-t border-border">
                <a href="#waitlist-form" onClick={(e) => handleAnchorClick(e, '#waitlist-form')}>
                  <Button size="sm" className="w-full justify-center glow-effect">
                    Join Waitlist
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </nav>
      </div>
    </motion.header>
  )
}

export default WaitlistNavbar
