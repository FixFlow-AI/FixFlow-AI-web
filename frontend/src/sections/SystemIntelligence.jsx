import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { intelligenceStages } from "../data/landing";
import { InteractiveBriefSimulator } from "../components/InteractiveBriefSimulator";

export function SystemIntelligence() {
  const [activeStep, setActiveStep] = useState(0);
  const reducedMotion = useReducedMotion();

  return (
    <section id="intelligence" className="section-band intelligence-section" style={{ padding: "110px 0 90px" }}>
      <div className="section-shell">
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <span className="panel-label inline-flex items-center gap-2 mb-3 text-blue-600 font-semibold uppercase text-xs tracking-wider">
            <Sparkles size={14} className="text-blue-600" />
            AI Intelligence Layer
          </span>
          <RevealText as="h2" className="section-title text-3xl md:text-4xl font-bold tracking-tight">
            System intelligence replaces marketplace <span className="text-blue-600">guesswork.</span>
          </RevealText>
          <p className="text-slate-600 mt-4 text-base md:text-lg leading-relaxed">
            The platform reads your brief, audits proof against real GitHub commit histories, predicts scope risks, and constructs a fundable agreement before anyone starts work.
          </p>
        </div>

        {/* Live Interactive Simulator Banner Component */}
        <div className="mb-16">
          <InteractiveBriefSimulator />
        </div>

        {/* Connected 5-Stage Pipeline Header */}
        <div className="pipeline-header-bar">
          <div className="pipeline-header-title">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              5-Stage Intelligence Pipeline & Signal Graph
            </span>
            <h3 className="text-xl font-extrabold text-slate-900 mt-1">
              How unstructured intent becomes cryptographically verifiable milestones
            </h3>
          </div>
        </div>

        {/* 5-Stage Pipeline Grid */}
        <div className="intelligence-stages-grid">
          {intelligenceStages.map((stage, i) => {
            const Icon = stage.icon;
            const isActive = activeStep === i;

            return (
              <motion.div
                key={stage.label}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : i * 0.08 }}
                className={`stage-card ${isActive ? "is-active" : ""}`}
                onMouseEnter={() => setActiveStep(i)}
                onClick={() => setActiveStep(i)}
              >
                {/* Top Badge & Number */}
                <div className="stage-card-top">
                  <div className="stage-icon-wrap">
                    <Icon size={16} className="stage-icon" />
                  </div>
                  <span className="stage-step-num">STEP 0{i + 1}</span>
                </div>

                {/* Content */}
                <h4 className="stage-title">{stage.label}</h4>
                <div className="stage-short-pill">{stage.short}</div>
                <p className="stage-description">{stage.description}</p>

                {/* Signal Data Box (Source vs Finding) */}
                <div className="stage-signal-box">
                  <div className="signal-row signal--source">
                    <span className="signal-lbl">Input Context:</span>
                    <span className="signal-txt">{stage.source}</span>
                  </div>
                  <div className="signal-row signal--finding">
                    <span className="signal-lbl">AI Finding:</span>
                    <span className="signal-txt">{stage.finding}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
