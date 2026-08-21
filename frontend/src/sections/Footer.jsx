import { Brand } from "../components/Brand";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="section-shell footer-layout">
        <div className="footer-brand">
          <Brand compact />
          <p>From project brief to protected delivery, in one shared record.</p>
        </div>
        <nav className="footer-nav" aria-label="Footer navigation">
          <div><strong>Product</strong><a href="#intelligence">Intelligence</a><a href="#workflow">Workflow</a><a href="#trust">Trust</a></div>
          <div><strong>For teams</strong><a href="#problem">Clients</a><a href="#problem">Freelancers</a><a href="#problem">Agencies</a><a href="#problem">Developers</a></div>
          <div><strong>Access</strong><a href="#/signup">Request access</a><a href="#/login">Log in</a></div>
        </nav>
      </div>
      <div className="section-shell footer-bottom"><span>© {year} FixFlowAI</span><span>Trust-first freelance infrastructure.</span></div>
    </footer>
  );
}
