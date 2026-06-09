import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Github, Twitter, Linkedin } from 'lucide-react'

const footerLinks = {
  navigate: [
    { label: 'Home', href: '#home' },
    { label: 'Workflow', href: '#workflow' },
    { label: 'Gaps & Risks', href: '#intelligence' },
    { label: 'Early Access', href: '#waitlist-form' },
  ],
  join: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
    { label: 'Data Governance', href: '#' },
  ],
}

function WaitlistFooter() {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-40px' })

  const handleAnchorClick = (e, href) => {
    if (href.startsWith('#')) {
      e.preventDefault()
      const element = document.querySelector(href)
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <motion.footer
      ref={ref}
      initial={{ opacity: 0 }}
      animate={isInView ? { opacity: 1 } : {}}
      transition={{ duration: 0.8 }}
      className="border-t border-border bg-card/30"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <motion.div
            className="sm:col-span-2 lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <a href="#home" onClick={(e) => handleAnchorClick(e, '#home')} className="flex items-center gap-2.5 mb-4">
              <motion.div whileHover={{ scale: 1.05 }} transition={{ type: 'spring', stiffness: 300 }}>
                <img src="/official-logo.png" className="h-6 w-6 object-contain" alt="FixFlow AI logo" />
              </motion.div>
              <span className="text-lg font-bold text-foreground">FixFlow AI</span>
            </a>
            <p className="text-sm text-muted-foreground mb-4 leading-relaxed max-w-sm">
              The proposal operating system for client work. Automatically turn messy briefs into execution-ready proposals, client portals, and secure payment setups.
            </p>
            <div className="flex items-center gap-4">
              {[Twitter, Github, Linkedin].map((Icon, i) => (
                <motion.a
                  key={i} href="#"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={Icon.displayName}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={isInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: 0.3 + i * 0.08 }}
                >
                  <Icon className="h-4 w-4" />
                </motion.a>
              ))}
            </div>
          </motion.div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <h4 className="font-semibold text-sm mb-4">Navigate</h4>
            <ul className="space-y-2">
              {footerLinks.navigate.map((link) => (
                <li key={link.label}>
                  <motion.a href={link.href} onClick={(e) => handleAnchorClick(e, link.href)}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </motion.a>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Legal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <h4 className="font-semibold text-sm mb-4">Legal & Security</h4>
            <ul className="space-y-2">
              {footerLinks.join.map((link) => (
                <li key={link.label}>
                  <motion.a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {link.label}
                  </motion.a>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Bottom */}
        <motion.div
          className="mt-12 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} FixFlow AI. All rights reserved.</p>
          <p className="text-xs text-muted-foreground text-center">Secure client onboarding and project scoping system.</p>
        </motion.div>
      </div>
    </motion.footer>
  )
}

export default WaitlistFooter
