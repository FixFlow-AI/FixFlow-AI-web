import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Plus } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { faqs } from "../data/landing";

export function Faq() {
  const [openIndex, setOpenIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  return (
    <section className="faq" id="faq" aria-labelledby="faq-title">
      <div className="section-shell faq-shell">
        <div className="faq-intro">
          <span className="panel-label faq-kicker">FAQ</span>
          <RevealText as="h2" id="faq-title" className="section-title faq-title">
            Answers before you commit.
          </RevealText>
          <p className="faq-sub">
            The questions clients, freelancers, and teams ask most before they
            request access.
          </p>
        </div>

        <dl className="faq-list">
          {faqs.map((item, idx) => {
            const isOpen = openIndex === idx;
            const panelId = `faq-panel-${idx}`;
            const buttonId = `faq-button-${idx}`;
            return (
              <div className={`faq-item${isOpen ? " is-open" : ""}`} key={item.q}>
                <dt>
                  <button
                    type="button"
                    id={buttonId}
                    className="faq-question"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                  >
                    <span>{item.q}</span>
                    <Plus
                      className="faq-icon"
                      aria-hidden="true"
                      size={20}
                      strokeWidth={2}
                    />
                  </button>
                </dt>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.dd
                      id={panelId}
                      role="region"
                      aria-labelledby={buttonId}
                      className="faq-answer"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: reducedMotion ? 0 : 0.28, ease: "easeInOut" }}
                    >
                      <p>{item.a}</p>
                    </motion.dd>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}
