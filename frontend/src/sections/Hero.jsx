import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Play,
  Pause,
  Check,
  FileText,
  ShieldCheck,
  Layers,
  Lock,
  Sparkles,
  GitCommit,
  CheckCircle2,
  FileCheck2,
  BadgeCheck,
} from "lucide-react";
import { RevealText } from "../components/RevealText";
import { audiences, heroSteps, heroTrustMarkers } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

/* Rich visual system cards for non-technical clients & freelancers */
const systemCards = [
  {
    id: "brief",
    stepIndex: 0,
    label: "Smart Brief",
    sublabel: "AI Requirement Intake",
    icon: FileText,
    iconColor: "#2563eb",
    iconBg: "rgba(37, 99, 235, 0.1)",
    badgeText: "AI Scanned",
    badgeType: "blue",
    file: {
      name: "client_brief.pdf",
      time: "0.8s scan",
    },
    meter: {
      label: "Clarity & Structure",
      value: "96%",
      percent: 96,
      color: "blue",
    },
    highlight: {
      icon: Sparkles,
      text: "28 Key Signals Structured",
    },
    footer: "Zero ambiguity before hiring",
  },
  {
    id: "proof",
    stepIndex: 1,
    label: "Verified Proof",
    sublabel: "GitHub & Codebase Match",
    icon: ShieldCheck,
    iconColor: "#059669",
    iconBg: "rgba(5, 150, 105, 0.1)",
    badgeText: "98% Match",
    badgeType: "emerald",
    statRow: {
      primary: "Strong Engineering Fit",
      tag: "Top 1% Rank",
    },
    chips: [
      { text: "14 Commits Vetted", icon: GitCommit },
      { text: "Live Repos", icon: CheckCircle2 },
    ],
    footer: "Real code proof, zero spam bids",
  },
  {
    id: "scope",
    stepIndex: 2,
    label: "Milestone Scope",
    sublabel: "Auto-Scoped Roadmap",
    icon: Layers,
    iconColor: "#4f46e5",
    iconBg: "rgba(79, 70, 229, 0.1)",
    badgeText: "6 Milestones",
    badgeType: "indigo",
    statRow: {
      primary: "6 Phased Milestones",
      tag: "120h Est.",
    },
    meter: {
      label: "Delivery Predictability",
      value: "94%",
      percent: 94,
      color: "indigo",
    },
    footer: "Pre-agreed sign-off criteria",
  },
  {
    id: "escrow",
    stepIndex: 3,
    label: "Guaranteed Escrow",
    sublabel: "Milestone Payout Protection",
    icon: Lock,
    iconColor: "#d97706",
    iconBg: "rgba(217, 119, 6, 0.1)",
    badgeText: "Funds Secured",
    badgeType: "amber",
    statRow: {
      primary: "100% Escrow Protection",
      tag: "Milestone 1 Funded",
    },
    chips: [
      { text: "Locked in Escrow", icon: Lock },
      { text: "Paid on Sign-off", icon: BadgeCheck },
    ],
    footer: "Safe funds, zero payment disputes",
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
    const timer = window.setTimeout(() => setHeroStep(heroStep + 1), 1200);
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
        <div className="hero-stage">
          {/* Stage top header bar */}
          <div className="hero-stage-topbar">
            <div className="hero-stage-badge">
              <span className="hero-stage-live-dot" aria-hidden="true" />
              <span>FixFlow Trust Engine</span>
            </div>
            <div className="hero-stage-sync">
              {demoRunning ? (
                <span className="hero-stage-sync-active">
                  <span className="sync-pulse-dot" />
                  Step {heroStep + 1}/4: {heroSteps[heroStep]?.label}
                </span>
              ) : (
                <span className="hero-stage-sync-idle">4-Point Trust Workflow</span>
              )}
            </div>
          </div>

          {/* 2x2 Clean Responsive Grid */}
          <div className="hero-cards-grid">
            {systemCards.map((card, idx) => {
              const Icon = card.icon;
              const isActive = demoRunning && heroStep === card.stepIndex;

              return (
                <motion.div
                  key={card.id}
                  className={`hero-card hero-card--${card.badgeType} ${isActive ? "is-active" : ""}`}
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.5,
                    delay: reducedMotion ? 0 : 0.12 + idx * 0.08,
                  }}
                >
                  <div className="hero-card-header">
                    <div
                      className="hero-card-icon-wrap"
                      style={{ background: card.iconBg, color: card.iconColor }}
                    >
                      <Icon size={16} strokeWidth={2.2} />
                    </div>
                    <div className="hero-card-title-group">
                      <span className="hero-card-label">{card.label}</span>
                      <span className="hero-card-sublabel">{card.sublabel}</span>
                    </div>
                    <span className={`hero-card-status-badge badge--${card.badgeType}`}>
                      {card.badgeText}
                    </span>
                  </div>

                  <div className="hero-card-body">
                    {/* File Attachment Pill */}
                    {card.file && (
                      <div className="hero-card-file-pill">
                        <FileCheck2 size={13} className="hero-card-file-icon" />
                        <span className="hero-card-file-name">{card.file.name}</span>
                        <span className="hero-card-file-tag">{card.file.time}</span>
                      </div>
                    )}

                    {/* Stat Highlight Row */}
                    {card.statRow && (
                      <div className="hero-card-stat-row">
                        <span className="hero-card-stat-primary">{card.statRow.primary}</span>
                        <span className={`hero-card-stat-tag tag--${card.badgeType}`}>
                          {card.statRow.tag}
                        </span>
                      </div>
                    )}

                    {/* Visual Meter Bar */}
                    {card.meter && (
                      <div className="hero-card-meter">
                        <div className="hero-card-meter-header">
                          <span>{card.meter.label}</span>
                          <strong>{card.meter.value}</strong>
                        </div>
                        <div className="hero-card-meter-track">
                          <div
                            className={`hero-card-meter-fill meter--${card.meter.color}`}
                            style={{ width: `${card.meter.percent}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Highlight Pill */}
                    {card.highlight && (
                      <div className="hero-card-chips">
                        <span className="hero-card-chip">
                          <card.highlight.icon size={11} />
                          {card.highlight.text}
                        </span>
                      </div>
                    )}

                    {/* Feature Chips */}
                    {card.chips && (
                      <div className="hero-card-chips">
                        {card.chips.map((chip, i) => {
                          const ChipIcon = chip.icon;
                          return (
                            <span key={i} className="hero-card-chip">
                              <ChipIcon size={11} />
                              {chip.text}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {/* Card Footer Reassurance */}
                    <div className="hero-card-footer-pill">
                      <Check size={11} className="hero-card-check" />
                      <span>{card.footer}</span>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Stage Bottom Footer */}
          <div className="hero-stage-footer">
            <span>● Verified GitHub Proof</span>
            <span>● Scoped Milestones</span>
            <span>● 100% Escrow Security</span>
          </div>
        </div>
      </div>

      {/* Anchor to next section */}
      <a className="hero-next" href="#problem" style={{ visibility: "hidden", position: "absolute" }}>
        Next
      </a>
    </section>
  );
}
