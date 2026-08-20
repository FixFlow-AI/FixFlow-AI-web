import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { RevealText } from "../components/RevealText";
import { audiences } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";
import { CheckCircle2, XCircle, ArrowRight, ShieldCheck } from "lucide-react";

export function Problem() {
  const currentAudience = useLandingStore((s) => s.audience);
  const setAudience = useLandingStore((s) => s.setAudience);
  const reducedMotion = useReducedMotion();

  const activeAudienceObj = audiences.find((a) => a.id === currentAudience) || audiences[0];

  return (
    <section className="section-band" id="problem" style={{ padding: "100px 0 90px" }}>
      <div className="section-shell">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.span
            initial={{ opacity: 0, y: -8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="panel-label inline-flex items-center gap-2 mb-3 text-blue-600 font-semibold uppercase text-xs tracking-wider"
          >
            <ShieldCheck size={14} />
            Relatable Problem & Solution
          </motion.span>
          <RevealText as="h2" className="section-title text-3xl md:text-4xl font-bold tracking-tight">
            The old marketplace forces everyone into the wrong work.
          </RevealText>
          <p className="text-slate-600 mt-4 text-base md:text-lg leading-relaxed">
            Select your role to see how FixFlowAI eliminates high-friction bidding chaos, payment anxiety, and scope drift.
          </p>
        </div>

        {/* Persona Role Switcher Tabs */}
        <div className="audience-tabs-bar">
          {audiences.map((aud) => {
            const Icon = aud.icon;
            const isActive = currentAudience === aud.id;
            return (
              <motion.button
                key={aud.id}
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`audience-tab-button relative ${isActive ? "is-active" : ""}`}
                onClick={() => setAudience(aud.id)}
              >
                <Icon size={18} />
                <span>{aud.title}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeAudienceBadge"
                    className="absolute inset-0 bg-blue-600 rounded-full -z-10"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Active Persona Pain vs FixFlowAI Solution Card */}
        <div className="persona-card-stage mt-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeAudienceObj.id}
              initial={{ opacity: 0, y: reducedMotion ? 0 : 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reducedMotion ? 0 : -20, scale: 0.98 }}
              transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="persona-split-grid"
            >
              {/* Old Way (The Pain) */}
              <motion.div
                whileHover={{ y: -4 }}
                className="persona-pane pane--old"
              >
                <div className="pane-title-badge text-red-600 bg-red-50 border-red-200">
                  <XCircle size={15} />
                  The Legacy Marketplace Burden
                </div>
                <h3 className="pane-heading">What slows you down today</h3>
                <p className="pane-description">{activeAudienceObj.burden}</p>
                <div className="pane-footer-pill bg-red-50/60 text-red-700">
                  ⚠️ Result: High stress, wasted hours, and friction on every deal.
                </div>
              </motion.div>

              {/* FixFlowAI Way (The Solution) */}
              <motion.div
                whileHover={{ y: -4 }}
                className="persona-pane pane--new"
              >
                <div className="pane-title-badge text-emerald-600 bg-emerald-50 border-emerald-200">
                  <CheckCircle2 size={15} />
                  The FixFlowAI Way
                </div>
                <h3 className="pane-heading">How FixFlowAI transforms your workflow</h3>
                <p className="pane-description">{activeAudienceObj.shift}</p>

                <div className="outcome-box">
                  <span className="outcome-label">Guaranteed Outcome:</span>
                  <p className="outcome-text">{activeAudienceObj.outcome}</p>
                </div>

                <div className="mt-6">
                  <motion.a
                    whileHover={{ x: 4 }}
                    href="#/signup"
                    className="button button--small nav-cta inline-flex items-center gap-2"
                  >
                    Experience {activeAudienceObj.title} Workflow
                    <ArrowRight size={15} />
                  </motion.a>
                </div>
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
