import { ArrowUpRight } from 'lucide-react'
import { Brand } from '../components/Brand'

export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="site-footer">
      <div className="section-shell footer-grid">
        <div className="footer-brand">
          <Brand />
          <p>Trust infrastructure from the first project request to accepted delivery.</p>
        </div>
        <div className="footer-links">
          <div>
            <strong>Product</strong>
            <a href="#intelligence">Intelligence</a>
            <a href="#workflow">Workflow</a>
            <a href="#trust">Trust</a>
          </div>
          <div>
            <strong>For</strong>
            <a href="#problem">Clients</a>
            <a href="#problem">Freelancers</a>
            <a href="#problem">Agencies</a>
            <a href="#problem">Developers</a>
          </div>
          <div>
            <strong>Access</strong>
            <a href="#early-access">Join early access <ArrowUpRight aria-hidden="true" size={14} /></a>
            <a href="https://www.fixflowai.xyz/" target="_blank" rel="noreferrer">
              Current site <ArrowUpRight aria-hidden="true" size={14} />
            </a>
          </div>
        </div>
      </div>
      <div className="section-shell footer-base">
        <span>© {year} FixFlowAI</span>
        <span>Brief. Proof. Agreement. Delivery.</span>
      </div>
    </footer>
  )
}
