import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { intelligenceStages } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

export function SystemIntelligence() {
  const step = useLandingStore((state) => state.intelligenceStep);
  const setStep = useLandingStore((state) => state.setIntelligenceStep);
  const reducedMotion = useReducedMotion();
  const active = intelligenceStages[step];
  const ActiveIcon = active.icon;

  return (
    <section className="landing-section intelligence-section" id="intelligence">
      <div className="section-shell">
        <div className="landing-heading landing-heading--split">
          <span className="landing-index">02 / System intelligence</span>
          <RevealText as="h2" className="section-title">
            System intelligence replaces marketplace guesswork.
          </RevealText>
          <p className="section-copy">
            Nothing hides behind an AI label. You can see what was understood,
            what remains uncertain, and which evidence supports the next decision.
          </p>
        </div>
        <div className="intelligence-rail" role="tablist" aria-label="Intelligence stages">
          {intelligenceStages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <button
                className={step === index ? "is-active" : ""}
                key={stage.label}
                type="button"
                role="tab"
                aria-selected={step === index}
                onClick={() => setStep(index)}
              >
                <span className="intelligence-stage-number">0{index + 1}</span>
                <Icon aria-hidden="true" size={18} />
                <strong>{stage.label}</strong>
                <small>{stage.short}</small>
              </button>
            );
          })}
        </div>

        <motion.div
          className="intelligence-inspector"
          key={active.label}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.25 }}
          aria-live="polite"
        >
          <div className="intelligence-inspector-summary">
            <span className="inspector-label">Stage 0{step + 1}</span>
            <ActiveIcon aria-hidden="true" size={24} />
            <h3>{active.label}</h3>
            <p>{active.description}</p>
          </div>
          <div className="intelligence-inspector-record">
            <div><span>Source or evidence</span><p>{active.source}</p></div>
            <ArrowRight aria-hidden="true" size={18} />
            <div><span>System finding</span><p>{active.finding}</p></div>
            <div className="human-review"><CheckCircle2 aria-hidden="true" size={16} /><span>Visible for human review before the next stage</span></div>
          </div>
        </motion.div>

        <div className="section-screen" aria-label="Product interface: Evidence confidence view">
          <div className="section-screen-bar" aria-hidden="true">
            <span /><span /><span />
          </div>
          <img
            src="/product-screens/fixflow-evidence-confidence-v1.png"
            alt="FixFlowAI evidence view showing requirements mapped to evidence relationships with confidence scores — strong evidence, relevant evidence, and open questions"
            loading="lazy"
            width="1340"
            height="856"
          />
        </div>
      </div>
    </section>
  );
}
