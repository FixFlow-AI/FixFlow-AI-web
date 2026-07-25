import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Play, Pause, Check } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { audiences, heroSteps, heroTrustMarkers } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

/* Floating code-card data — matches the hero concept image */
const systemCards = [
  {
    label: "Brief",
    icon: "📄",
    code: `{
  "source": "client_brief.pdf",
  "signals": 28,
  "clarity": 62
}`,
    style: { top: "8%", right: "30%", zIndex: 3 },
  },
  {
    label: "Proof",
    icon: "✓",
    code: `{
  "match_quality": 0.92,
  "verified_skills": 14,
  "fit_reason": "Strong"
}`,
    style: { top: "38%", right: "55%", zIndex: 2 },
  },
  {
    label: "Scope",
    icon: "⊕",
    code: `{
  "estimate": "120h",
  "milestones": 6,
  "confidence": 0.86
}`,
    style: { top: "12%", right: "2%", zIndex: 1 },
  },
  {
    label: "Escrow",
    icon: "🔒",
    code: `{
  "protection": "escrow",
  "release": "milestone",
  "status": "secured"
}`,
    style: { top: "52%", right: "5%", zIndex: 1 },
  },
];

export function Hero() {
  const heroStep = useLandingStore((state) => state.heroStep);
  const demoRunning = useLandingStore((state) => state.demoRunning);
  const setHeroStep = useLandingStore((state) => state.setHeroStep);
  const setDemoRunning = useLandingStore((state) => state.setDemoRunning);
  const setAudience = useLandingStore((state) => state.setAudience);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!demoRunning || reducedMotion) return undefined;
    if (heroStep >= heroSteps.length - 1) {
      const stopTimer = window.setTimeout(() => setDemoRunning(false), 900);
      return () => window.clearTimeout(stopTimer);
    }
    const timer = window.setTimeout(() => setHeroStep(heroStep + 1), 1050);
    return () => window.clearTimeout(timer);
  }, [demoRunning, heroStep, reducedMotion, setDemoRunning, setHeroStep]);

  const toggleDemo = () => {
    if (demoRunning) {
      setDemoRunning(false);
      return;
    }
    setHeroStep(0);
    if (reducedMotion) {
      setHeroStep(heroSteps.length - 1);
    } else {
      setDemoRunning(true);
    }
  };

  return (
    <section className="hero section-grid" id="top">
      {/* Premium ambient backdrop (aurora glow + fine grid) */}
      <div className="hero-aurora" aria-hidden="true" />

      {/* Left: Copy */}
      <div className="hero-copy">
        <div className="hero-eyebrow">
          <span className="hero-eyebrow-dot" aria-hidden="true" />
          Trust-first freelance workspace
        </div>
        <RevealText as="h1" className="hero-title">
          Work moves when trust is{" "}
          <span className="hero-accent">already built.</span>
        </RevealText>
        <p className="hero-description">
          FixFlowAI turns messy briefs, verified skills, scoped proposals, and
          milestone-escrow payments into one shared operating layer — so hiring
          starts with proof, not promises.
        </p>
        <div className="hero-actions">
          <a className="button" href="#/signup">
            Request access
            <ArrowRight aria-hidden="true" size={18} />
          </a>
          <button
            className="button button--quiet"
            type="button"
            onClick={toggleDemo}
          >
            {demoRunning ? (
              <Pause aria-hidden="true" size={17} />
            ) : (
              <Play aria-hidden="true" size={17} />
            )}
            {demoRunning ? "Pause system" : "Watch the system think"}
          </button>
        </div>

        {/* Hard-proof differentiators */}
        <div className="hero-stats" aria-label="Why FixFlowAI">
          <div className="hero-stat">
            <strong>&lt;60s</strong>
            <span>to a verified match</span>
          </div>
          <div className="hero-stat">
            <strong>100%</strong>
            <span>milestone-escrow protected</span>
          </div>
          <div className="hero-stat">
            <strong>Zero</strong>
            <span>proposal spam</span>
          </div>
        </div>

        <ul className="hero-trust" aria-label="What to expect">
          {heroTrustMarkers.map((marker) => (
            <li key={marker}>
              <Check aria-hidden="true" size={14} strokeWidth={2.4} />
              {marker}
            </li>
          ))}
        </ul>
        <div className="hero-audiences" aria-label="Built for">
          <span>Built for</span>
          {audiences.map((audience) => (
            <a
              href="#problem"
              key={audience.id}
              onClick={() => setAudience(audience.id)}
            >
              {audience.title.toLowerCase()}
            </a>
          ))}
        </div>
      </div>

      {/* Right: Floating system cards on a premium glass stage */}
      <div className="hero-system hero-system--cards">
        <div className="hero-stage" aria-hidden="true" />
        {systemCards.map((card, idx) => (
          <motion.div
            key={card.label}
            className="hero-card"
            style={card.style}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.6,
              delay: reducedMotion ? 0 : 0.2 + idx * 0.12,
            }}
          >
            <div className="hero-card-header">
              <span className="hero-card-icon">{card.icon}</span>
              <span className="hero-card-label">{card.label}</span>
              <span className="hero-card-dots">•••</span>
            </div>
            <pre className="hero-card-code">{card.code}</pre>
          </motion.div>
        ))}

        {/* Connecting dots */}
        <div className="hero-card-dot" style={{ top: "50%", left: "50%", width: 10, height: 10, background: "var(--brand)" }} />
      </div>

      {/* Anchor to next section */}
      <a className="hero-next" href="#problem" style={{ visibility: "hidden", position: "absolute" }}>
        Next
      </a>
    </section>
  );
}
