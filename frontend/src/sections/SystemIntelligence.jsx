import { motion, useReducedMotion } from "framer-motion";
import { ArrowDownRight, Check, CircleAlert } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { intelligenceStages } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

export function SystemIntelligence() {
  const activeIndex = useLandingStore((state) => state.intelligenceStep);
  const setActiveIndex = useLandingStore((state) => state.setIntelligenceStep);
  const reducedMotion = useReducedMotion();
  const active = intelligenceStages[activeIndex];

  return (
    <section className="intelligence section-band" id="intelligence">
      <div className="section-shell">
        <SectionHeading
          index="02"
          title="System intelligence replaces marketplace guesswork."
          copy="FixFlowAI does not hide the decision behind an AI label. It shows what was understood, what remains uncertain, which proof matters, and what must be agreed before work begins."
        />

        <div
          className="intelligence-rail"
          role="tablist"
          aria-label="System intelligence stages"
        >
          {intelligenceStages.map((stage, index) => {
            const StageIcon = stage.icon;
            const isActive = activeIndex === index;
            return (
              <button
                className={`intelligence-tab${isActive ? " is-active" : ""}`}
                key={stage.label}
                role="tab"
                type="button"
                aria-selected={isActive}
                aria-controls="intelligence-panel"
                onClick={() => setActiveIndex(index)}
              >
                <span className="intelligence-tab-icon">
                  <StageIcon aria-hidden="true" size={18} strokeWidth={1.8} />
                </span>
                <span>
                  <small>0{index + 1}</small>
                  <strong>{stage.label}</strong>
                  <em>{stage.short}</em>
                </span>
              </button>
            );
          })}
        </div>

        <motion.div
          className="intelligence-panel"
          id="intelligence-panel"
          role="tabpanel"
          key={active.label}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.35 }}
        >
          <div className="intelligence-summary">
            <span className="inspector-label">Current reasoning stage</span>
            <h3>{active.label}</h3>
            <p>{active.description}</p>
            <button
              className="text-action"
              type="button"
              onClick={() =>
                setActiveIndex((activeIndex + 1) % intelligenceStages.length)
              }
            >
              Inspect next stage
              <ArrowDownRight aria-hidden="true" size={17} />
            </button>
          </div>
          <div className="intelligence-inspection">
            <div className="inspection-row">
              <span className="inspection-icon">
                <Check aria-hidden="true" size={16} />
              </span>
              <div>
                <small>Source or signal</small>
                <p>{active.source}</p>
              </div>
            </div>
            <div className="inspection-row inspection-row--finding">
              <span className="inspection-icon">
                <CircleAlert aria-hidden="true" size={16} />
              </span>
              <div>
                <small>System finding</small>
                <p>{active.finding}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
