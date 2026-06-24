import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, Check, Fingerprint, Link2 } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { trustEvents } from "../data/landing";

export function Trust() {
  const [activeIndex, setActiveIndex] = useState(2);
  const reducedMotion = useReducedMotion();
  const active = trustEvents[activeIndex];

  return (
    <section className="trust section-band" id="trust">
      <div className="section-shell">
        <SectionHeading
          index="06"
          title="Trust is not a profile badge. It is a trail."
          copy="Every important claim should point back to a source, decision, acceptance event, or completed outcome."
        />

        <div className="trust-layout">
          <div className="trust-statement">
            <Fingerprint aria-hidden="true" size={32} strokeWidth={1.45} />
            <h3>
              Confidence stays inspectable from requirement to reputation.
            </h3>
            <p>
              A rating summarizes an opinion. An evidence trail preserves what
              was requested, what was proven, what was agreed, and what was
              accepted.
            </p>
            <div className="trust-source-line">
              <Link2 aria-hidden="true" size={16} />
              <span>Sources remain attached to every verified event</span>
            </div>
          </div>

          <ol className="trust-timeline">
            {trustEvents.map(([label, description], index) => (
              <li
                className={activeIndex === index ? "is-active" : ""}
                key={label}
              >
                <button
                  type="button"
                  aria-current={activeIndex === index ? "step" : undefined}
                  onClick={() => setActiveIndex(index)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="trust-event-index">0{index + 1}</span>
                  <span className="trust-event-mark">
                    <Check aria-hidden="true" size={13} />
                  </span>
                  <strong>{label}</strong>
                  <ArrowDownRight aria-hidden="true" size={17} />
                </button>
                <AnimatePresence initial={false}>
                  {activeIndex === index ? (
                    <motion.p
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: reducedMotion ? 0 : 0.25 }}
                    >
                      {description}
                    </motion.p>
                  ) : null}
                </AnimatePresence>
              </li>
            ))}
          </ol>
        </div>

        <div className="trust-current" aria-live="polite">
          <span>Current proof event</span>
          <strong>{active[0]}</strong>
          <p>{active[1]}</p>
        </div>
      </div>
    </section>
  );
}
