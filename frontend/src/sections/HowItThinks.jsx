import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { thinkingSteps } from "../data/landing";

export function HowItThinks() {
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const active = thinkingSteps[activeIndex];
  const ActiveIcon = active.icon;

  return (
    <section className="landing-section thinking-section" aria-labelledby="thinking-title">
      <div className="section-shell thinking-layout">
        <div className="thinking-copy">
          <span className="landing-index">03 / Decision path</span>
          <RevealText as="h2" className="section-title" id="thinking-title">
            From raw request to protected execution.
          </RevealText>
          <p className="section-copy">
            The system removes repetitive coordination while keeping judgment,
            approval, pricing, and release decisions with people.
          </p>
          <div className="thinking-tabs" role="tablist" aria-label="Decision path">
            {thinkingSteps.map((item, index) => (
              <button
                className={activeIndex === index ? "is-active" : ""}
                key={item.label}
                type="button"
                role="tab"
                aria-selected={activeIndex === index}
                onClick={() => setActiveIndex(index)}
              >
                <span>0{index + 1}</span>
                <strong>{item.label}</strong>
                <ArrowRight aria-hidden="true" size={15} />
              </button>
            ))}
          </div>
        </div>

        <div className="thinking-canvas">
          <div className="thinking-canvas-topbar"><span>Shared project record</span><span>Step {activeIndex + 1} of {thinkingSteps.length}</span></div>
          <AnimatePresence mode="wait">
            <motion.div
              className="thinking-inspector"
              key={active.label}
              initial={{ opacity: 0, x: reducedMotion ? 0 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reducedMotion ? 0 : -8 }}
              transition={{ duration: reducedMotion ? 0 : 0.25 }}
            >
              <div className="thinking-inspector-icon"><ActiveIcon aria-hidden="true" size={24} /></div>
              <span className="landing-index">{active.label}</span>
              <h3>{active.title}</h3>
              <p>{active.description}</p>
              <div className="thinking-output"><span>Output added to the record</span><strong>{active.output}</strong></div>
            </motion.div>
          </AnimatePresence>
          <div className="thinking-canvas-footer"><span>Inputs remain attached</span><span>Changes remain reviewable</span><span>Approval stays human</span></div>
        </div>
      </div>
    </section>
  );
}
