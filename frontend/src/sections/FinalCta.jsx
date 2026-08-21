import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, LockKeyhole } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { roleMessages } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

const roles = ["client", "freelancer", "agency", "developer"];

export function FinalCta() {
  const audience = useLandingStore((state) => state.audience);
  const setAudience = useLandingStore((state) => state.setAudience);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState(audience || "client");
  const [submitted, setSubmitted] = useState(false);
  const reducedMotion = useReducedMotion();

  useEffect(() => setRole(audience || "client"), [audience]);

  const chooseRole = (nextRole) => {
    setRole(nextRole);
    setAudience(nextRole);
    setSubmitted(false);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setAudience(role);
    window.location.hash = "#/signup";
  };

  return (
    <section className="landing-section final-cta-section" id="early-access">
      <div className="section-shell final-cta-layout">
        <div className="final-cta-copy">
          <span className="landing-index">07 / Early access</span>
          <RevealText as="h2" className="section-title">
            Start with a brief. Leave with a working agreement.
          </RevealText>
          <p className="section-copy">
            Join the early-access group for your role. Your onboarding path will
            focus on the decisions and safeguards that matter to how you work.
          </p>
          <div className="role-selector" role="group" aria-label="Choose your role">
            {roles.map((item) => (
              <button
                className={role === item ? "is-active" : ""}
                key={item}
                type="button"
                aria-pressed={role === item}
                onClick={() => chooseRole(item)}
              >{item}</button>
            ))}
          </div>
          <p className="role-message">{roleMessages[role]}</p>
        </div>

        <div className="access-panel">
          {submitted ? (
            <motion.div
              className="access-success"
              initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              role="status"
            >
              <span><Check aria-hidden="true" size={22} /></span>
              <h3>Your early-access request is ready.</h3>
              <p>Continue to account setup for the <strong>{role}</strong> onboarding path.</p>
              <a className="button" href="#/signup">Continue to account setup <ArrowRight aria-hidden="true" size={17} /></a>
              <button className="text-action" type="button" onClick={() => setSubmitted(false)}>Use another email</button>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="access-panel-header"><span>Early-access request</span><strong>{role}</strong></div>
              <label htmlFor="access-email">Work email</label>
              <input
                id="access-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                required
              />
              <input name="role" type="hidden" value={role} />
              <button className="button" type="submit">Request early access <ArrowRight aria-hidden="true" size={17} /></button>
              <p className="access-note"><LockKeyhole aria-hidden="true" size={13} />No credit card. Your project data stays private.</p>
            </form>
          )}
        </div>
      </div>

      <div className="section-shell cta-screens-shell">
        <div className="section-screen-pair">
          <div className="section-screen" aria-label="Product interface: AI Project Proposal Generator">
            <div className="section-screen-bar" aria-hidden="true">
              <span /><span /><span />
            </div>
            <img
              src="/product-screens/project-proposal-generator.png"
              alt="FixFlowAI AI Project Proposal Generator showing project description input, AI summary with scope, risk analysis, architecture, milestones, and acceptance criteria"
              loading="lazy"
              width="1340"
              height="856"
            />
          </div>
          <div className="section-screen" aria-label="Product interface: Role-based onboarding">
            <div className="section-screen-bar" aria-hidden="true">
              <span /><span /><span />
            </div>
            <img
              src="/product-screens/fixflow-role-onboarding-v1.png"
              alt="FixFlowAI workspace setup showing role-based onboarding with team evidence, roles and assignments, and workspace preview for agencies"
              loading="lazy"
              width="1340"
              height="856"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
