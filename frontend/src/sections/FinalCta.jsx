import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Mail } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { audiences, roleMessages } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

export function FinalCta() {
  const audience = useLandingStore((state) => state.audience);
  const setAudience = useLandingStore((state) => state.setAudience);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const reducedMotion = useReducedMotion();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setSubmitted(true);
  };

  return (
    <section className="final-cta" id="early-access">
      <div className="section-shell final-cta-grid">
        <div className="final-cta-copy">
          <RevealText className="final-cta-title">
            Start with a brief. Leave with a working agreement.
          </RevealText>
          <p>
            Join the early-access group for your role. We will use your
            onboarding path to shape the workflows that matter before launch.
          </p>
        </div>

        <div className="access-panel">
          <div
            className="role-selector"
            role="radiogroup"
            aria-label="Choose your role"
          >
            {audiences.map((item) => (
              <button
                className={audience === item.id ? "is-active" : ""}
                key={item.id}
                type="button"
                role="radio"
                aria-checked={audience === item.id}
                onClick={() => {
                  setAudience(item.id);
                  setSubmitted(false);
                }}
              >
                {item.title.replace(/s$/, "")}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              className="role-message"
              key={audience}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -4 }}
              transition={{ duration: reducedMotion ? 0 : 0.22 }}
            >
              {roleMessages[audience]}
            </motion.p>
          </AnimatePresence>

          {submitted ? (
            <motion.div
              className="access-success"
              initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              role="status"
            >
              <span>
                <Check aria-hidden="true" size={20} />
              </span>
              <div>
                <strong>You are on the early-access list.</strong>
                <p>We will contact you with the {audience} onboarding path.</p>
              </div>
            </motion.div>
          ) : (
            <form className="access-form" onSubmit={handleSubmit}>
              <label htmlFor="access-email">Work email</label>
              <div className="email-control">
                <Mail aria-hidden="true" size={18} />
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
              </div>
              <button className="button" type="submit">
                Request early access
                <ArrowRight aria-hidden="true" size={18} />
              </button>
            </form>
          )}
          <small className="access-note">
            Product updates only. No marketplace spam.
          </small>
        </div>
      </div>
    </section>
  );
}
