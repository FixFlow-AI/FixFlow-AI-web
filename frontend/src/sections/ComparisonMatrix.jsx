import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, X, ShieldCheck, Zap, GitCommit, Layers, Lock } from "lucide-react";
import { RevealText } from "../components/RevealText";

const COMPARISON_ROWS = [
  {
    feature: "Hiring & Talent Selection",
    legacy: "200+ spam proposals, manual resume vetting, keyword-stuffed profiles",
    fixflow: "Top 3–5 pre-verified candidates matched by GitHub code commits",
    icon: GitCommit,
  },
  {
    feature: "Requirement & Scope Clarity",
    legacy: "Unstructured chat briefs leading to scope creep & missed deadlines",
    fixflow: "AI Semantic Brief parsing (<60s) with structured scope & risk flags",
    icon: Zap,
  },
  {
    feature: "Payment & Escrow Protection",
    legacy: "Opaque holds, delayed releases, risk of unpaid work or chargebacks",
    fixflow: "100% upfront milestone escrow with SHA-256 cryptographically chained audit trails",
    icon: Lock,
  },
  {
    feature: "Fee & Overhead Tax",
    legacy: "Hidden 15%–20% freelancer commissions + buyer processing surcharges",
    fixflow: "Transparent, predictable fee structure with zero hidden taxes",
    icon: Layers,
  },
  {
    feature: "Project Collaboration",
    legacy: "Fragmented tools (email, Slack, Upwork messaging, external docs)",
    fixflow: "One unified operating workspace from initial brief intake to final payout",
    icon: ShieldCheck,
  },
];

export function ComparisonMatrix() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="section-band comparison-section" id="comparison" style={{ padding: "110px 0 90px" }}>
      <div className="section-shell">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <motion.span
            initial={{ opacity: 0, y: -8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="panel-label inline-flex items-center gap-2 mb-3 text-blue-600 font-semibold uppercase text-xs tracking-wider"
          >
            <span className="w-2 h-2 rounded-full bg-blue-600 inline-block animate-pulse" />
            Competitive Advantage
          </motion.span>
          <RevealText as="h2" className="section-title text-3xl md:text-4xl font-bold tracking-tight">
            Stop gambling on legacy bidding boards.
          </RevealText>
          <p className="text-slate-600 mt-4 text-base md:text-lg leading-relaxed">
            See how FixFlowAI’s evidence-first operating system replaces proposal noise, fee gouging, and scope disputes with deterministic trust.
          </p>
        </div>

        {/* Comparison Table / Cards */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="comparison-table-wrapper"
        >
          <div className="comparison-header-grid">
            <div className="comp-col-title">Core Capability</div>
            <div className="comp-col-legacy">Legacy Marketplaces (Upwork, Fiverr)</div>
            <div className="comp-col-fixflow">FixFlowAI Operating System</div>
          </div>

          <div className="comparison-body-grid">
            {COMPARISON_ROWS.map((row, idx) => {
              const Icon = row.icon;
              return (
                <motion.div
                  key={row.feature}
                  className="comparison-row"
                  initial={{ opacity: 0, x: reducedMotion ? 0 : -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  whileHover={{ backgroundColor: "rgba(248, 250, 252, 0.8)", scale: 1.002 }}
                  transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : idx * 0.08 }}
                >
                  <div className="comp-cell-feature">
                    <motion.div whileHover={{ rotate: 15 }} transition={{ type: "spring", stiffness: 300 }}>
                      <Icon size={18} className="text-blue-600 shrink-0" />
                    </motion.div>
                    <span>{row.feature}</span>
                  </div>

                  <div className="comp-cell-legacy">
                    <X size={16} className="comp-icon-x shrink-0" />
                    <span>{row.legacy}</span>
                  </div>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    className="comp-cell-fixflow"
                  >
                    <Check size={16} className="comp-icon-check shrink-0" />
                    <span>{row.fixflow}</span>
                  </motion.div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
