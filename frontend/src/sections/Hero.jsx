import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Pause, Play } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { audiences, heroSteps } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

export function Hero() {
  const heroStep = useLandingStore((state) => state.heroStep);
  const demoRunning = useLandingStore((state) => state.demoRunning);
  const setHeroStep = useLandingStore((state) => state.setHeroStep);
  const setDemoRunning = useLandingStore((state) => state.setDemoRunning);
  const setAudience = useLandingStore((state) => state.setAudience);
  const reducedMotion = useReducedMotion();
  const activeStep = heroSteps[heroStep];

  useEffect(() => {
    if (!demoRunning || reducedMotion) return undefined;
    if (heroStep === heroSteps.length - 1) {
      const stopTimer = window.setTimeout(() => setDemoRunning(false), 850);
      return () => window.clearTimeout(stopTimer);
    }
    const timer = window.setTimeout(() => setHeroStep(heroStep + 1), 1100);
    return () => window.clearTimeout(timer);
  }, [demoRunning, heroStep, reducedMotion, setDemoRunning, setHeroStep]);

  const toggleDemo = () => {
    if (demoRunning) return setDemoRunning(false);
    setHeroStep(reducedMotion ? heroSteps.length - 1 : 0);
    if (!reducedMotion) setDemoRunning(true);
  };

  return (
    <section className="hero section-grid" id="top">
      <div className="hero-copy">
        <RevealText as="h1" className="hero-title">
          Work moves when trust is already built.
        </RevealText>
        <p className="hero-description">
          FixFlowAI turns a raw project brief into a verified plan, proof-led
          match, protected milestones, and one shared delivery record.
        </p>
        <div className="hero-actions">
          <a className="button" href="#early-access">Request early access <ArrowRight aria-hidden="true" size={17} /></a>
          <button className="button button--quiet" type="button" onClick={toggleDemo}>
            {demoRunning ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
            {demoRunning ? "Pause workflow" : "Watch the system think"}
          </button>
        </div>

        <div className="hero-audiences" aria-label="Built for">
          <span>Built for</span>
          {audiences.map((item) => (
            <a href="#problem" key={item.id} onClick={() => setAudience(item.id)}>{item.title}</a>
          ))}
        </div>
      </div>

      <div className="hero-system" aria-label="FixFlowAI trust workflow">
        <div className="trust-canvas">
          <div className="trust-canvas-header">
            <div><span>Project trust record</span><strong>Billing service migration</strong></div>
            <span className="trust-canvas-state">Working example</span>
          </div>
          <div className="trust-canvas-rail" role="tablist" aria-label="Trust workflow stages">
            {heroSteps.map((step, index) => {
              const Icon = step.icon;
              const complete = index < heroStep;
              const active = index === heroStep;
              return (
                <button
                  className={`${active ? "is-active" : ""}${complete ? " is-complete" : ""}`}
                  key={step.label}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => { setDemoRunning(false); setHeroStep(index); }}
                >
                  <span className="trust-stage-icon">{complete ? <Check aria-hidden="true" size={15} /> : <Icon aria-hidden="true" size={16} />}</span>
                  <span><small>0{index + 1}</small><strong>{step.label}</strong></span>
                </button>
              );
            })}
          </div>
          <motion.div
            className="trust-canvas-inspector"
            key={activeStep.label}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
            aria-live="polite"
          >
            <div><span className="inspector-label">Current system state</span><h2>{activeStep.label}</h2><p>{activeStep.detail}</p></div>
            <span className="inspector-status"><Check aria-hidden="true" size={14} />{activeStep.status}</span>
          </motion.div>
          <div className="trust-canvas-footer"><span>Source linked</span><span>Decision visible</span><span>Human approval retained</span></div>
        </div>
      </div>
      <a className="hero-next" href="#problem"><span>Why the marketplace breaks trust</span><ArrowRight aria-hidden="true" size={17} /></a>
    </section>
  );
}
