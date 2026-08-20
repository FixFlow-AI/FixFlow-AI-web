import React, { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Calculator, Sparkles } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { pricingTiers } from "../data/landing";

export function Pricing() {
  const [annual, setAnnual] = useState(true);
  const [projectValue, setProjectValue] = useState(5000);
  const reducedMotion = useReducedMotion();

  // Legacy platform fee (20%) vs FixFlowAI fee (3.5% avg escrow fee)
  const legacyCut = Math.round(projectValue * 0.2);
  const fixflowCut = Math.round(projectValue * 0.035);
  const totalSavings = legacyCut - fixflowCut;

  return (
    <section className="pricing" id="pricing" aria-labelledby="pricing-title">
      <div className="section-shell">
        <div className="pricing-head">
          <motion.span
            initial={{ opacity: 0, y: -6 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="panel-label pricing-kicker"
          >
            Transparent Pricing & Value
          </motion.span>
          <RevealText as="h2" id="pricing-title" className="section-title pricing-title">
            Start free. Scale only when your volume does.
          </RevealText>
          <p className="pricing-sub">
            Transparent plans with milestone escrow protection built in. Zero surprise commission cuts.
          </p>

          <div className="billing-toggle" role="group" aria-label="Billing period">
            <button
              type="button"
              className={!annual ? "is-active" : ""}
              aria-pressed={!annual}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
            <button
              type="button"
              className={annual ? "is-active" : ""}
              aria-pressed={annual}
              onClick={() => setAnnual(true)}
            >
              Annual
              <span className="billing-save">Save 20%</span>
            </button>
          </div>
        </div>

        {/* Interactive Fee Savings Calculator Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="fee-calculator-card mb-14"
        >
          <div className="calc-header">
            <div className="calc-title">
              <Calculator size={18} className="text-blue-600 animate-bounce-slow" />
              <span>Interactive Fee Savings Calculator</span>
            </div>
            <motion.span
              whileHover={{ scale: 1.05 }}
              className="calc-badge cursor-default"
            >
              <Sparkles size={13} /> Compare vs Upwork / Fiverr
            </motion.span>
          </div>

          <div className="calc-body">
            <div className="slider-group">
              <div className="slider-label-row">
                <span className="text-sm font-semibold text-slate-700">Estimated Project Contract Value:</span>
                <motion.span
                  key={projectValue}
                  initial={{ scale: 1.15, color: "#2563eb" }}
                  animate={{ scale: 1, color: "#2563eb" }}
                  className="text-xl font-bold"
                >
                  ${projectValue.toLocaleString()}
                </motion.span>
              </div>
              <input
                type="range"
                min="1000"
                max="30000"
                step="500"
                value={projectValue}
                onChange={(e) => setProjectValue(Number(e.target.value))}
                className="fee-slider"
              />
              <div className="flex justify-between text-xs text-slate-400 mt-1 font-mono">
                <span>$1,000</span>
                <span>$15,000</span>
                <span>$30,000+</span>
              </div>
            </div>

            <div className="calc-results-grid">
              <motion.div whileHover={{ scale: 1.02 }} className="calc-res-item res--legacy">
                <span className="res-lbl">Upwork / Fiverr (20% Fee)</span>
                <span className="res-val text-red-600">-${legacyCut.toLocaleString()}</span>
                <span className="res-sub">Commission lost to platform</span>
              </motion.div>

              <motion.div whileHover={{ scale: 1.02 }} className="calc-res-item res--fixflow">
                <span className="res-lbl">FixFlowAI (3.5% Escrow)</span>
                <span className="res-val text-emerald-600">-${fixflowCut.toLocaleString()}</span>
                <span className="res-sub">Transparent milestone cost</span>
              </motion.div>

              <motion.div whileHover={{ scale: 1.03 }} className="calc-res-item res--savings shadow-sm">
                <span className="res-lbl">Your Direct Savings</span>
                <span className="res-val text-blue-600">+${totalSavings.toLocaleString()}</span>
                <span className="res-sub">Kept in your pocket per project</span>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Pricing Tiers Grid */}
        <div className="pricing-grid">
          {pricingTiers.map((tier, idx) => {
            const price = annual ? tier.annual : tier.monthly;
            return (
              <motion.article
                key={tier.id}
                className={`pricing-card${tier.featured ? " is-featured" : ""}`}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                whileHover={{ y: -8, transition: { type: "spring", stiffness: 300, damping: 20 } }}
                transition={{
                  duration: reducedMotion ? 0 : 0.4,
                  delay: reducedMotion ? 0 : idx * 0.1,
                }}
              >
                {tier.featured && <span className="pricing-badge">Most popular</span>}
                <h3 className="pricing-name">{tier.name}</h3>
                <p className="pricing-tagline">{tier.tagline}</p>

                <div className="pricing-price">
                  <span className="pricing-amount">{price === 0 ? "Free" : `$${price}`}</span>
                  {price !== 0 && (
                    <span className="pricing-period">/mo{annual ? ", billed yearly" : ""}</span>
                  )}
                </div>

                <motion.a
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`button${tier.featured ? "" : " button--quiet"} pricing-cta`}
                  href="#/signup"
                >
                  {tier.cta}
                  <ArrowRight aria-hidden="true" size={17} />
                </motion.a>

                <ul className="pricing-features">
                  {tier.features.map((feature) => (
                    <li key={feature}>
                      <Check aria-hidden="true" size={16} strokeWidth={2.2} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
