import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, ArrowRight, Check, Sparkles } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { automationRows } from "../data/landing";

export function Automation() {
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();
  const active = automationRows[activeIndex];

  return (
    <section className="automation section-shell" id="automation">
      <SectionHeading
        index="05"
        title="Automation without hiding the reasoning."
        copy="Repetitive coordination is handled by the system. Scope, pricing, funding, acceptance, and visibility remain under human control."
      />

      <div className="automation-table">
        <div className="automation-table-head" aria-hidden="true">
          <span>Work removed</span>
          <span>System behavior</span>
          <span>Human control</span>
        </div>
        {automationRows.map((row, index) => (
          <button
            className={`automation-row${activeIndex === index ? " is-active" : ""}`}
            type="button"
            key={row.work}
            onClick={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
          >
            <span className="automation-work">
              <small>0{index + 1}</small>
              <strong>{row.work}</strong>
            </span>
            <span>{row.automation}</span>
            <span>{row.control}</span>
            <ArrowDownRight aria-hidden="true" size={18} />
          </button>
        ))}
      </div>

      <motion.div
        className="automation-compare"
        key={active.work}
        initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.3 }}
      >
        <div>
          <span className="comparison-label">Before</span>
          <p>{active.before}</p>
        </div>
        <span className="compare-arrow">
          <ArrowRight aria-hidden="true" size={19} />
        </span>
        <div>
          <span className="comparison-label">
            <Sparkles aria-hidden="true" size={14} /> FixFlowAI
          </span>
          <p>{active.automation}</p>
        </div>
        <span className="compare-arrow">
          <ArrowRight aria-hidden="true" size={19} />
        </span>
        <div>
          <span className="comparison-label">
            <Check aria-hidden="true" size={14} /> Your control
          </span>
          <p>{active.control}</p>
        </div>
      </motion.div>
    </section>
  );
}
