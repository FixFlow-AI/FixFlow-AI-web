import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Sparkles, Shield, FileText, GitBranch, Eye } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { automationRows } from "../data/landing";

const showcasePanels = [
  {
    title: "Proposal composer",
    icon: FileText,
    color: "#2563eb",
    preview: (
      <div style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 11, color: "#475569", lineHeight: 1.7 }}>
        <div style={{ color: "#94a3b8" }}>{'proposal.md  v3 ⟷ vs ⟷ v2'}</div>
        <div style={{ marginTop: 8 }}>
          <span style={{ color: "#94a3b8" }}>1</span>{'  📋 🔗 📊 🏷️ 📐'}<br />
          <span style={{ color: "#94a3b8" }}>3</span>{'  ### Scope'}<br />
          <span style={{ color: "#94a3b8" }}>4</span>{'   - Build onboarding flow'}<br />
          <span style={{ color: "#94a3b8" }}>5</span>{'   - API integration'}<br />
          <span style={{ color: "#ef4444" }}>{'−'}</span>{' '}
          <span style={{ color: "#ef4444", textDecoration: "line-through" }}>Admin dashboard</span><br />
          <span style={{ color: "#16a34a" }}>{'+'}</span>{' '}
          <span style={{ color: "#16a34a" }}>Admin dashboard</span><br />
          <span style={{ color: "#16a34a" }}>{'+'}</span>{' '}
          <span style={{ color: "#16a34a" }}>Audit logs</span>
        </div>
      </div>
    ),
  },
  {
    title: "Escrow state machine",
    icon: Shield,
    color: "#16a34a",
    preview: (
      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.8 }}>
        <div><Check size={13} style={{ color: "#16a34a", display: "inline" }} /> <strong>Created</strong> <span style={{ color: "#94a3b8" }}>May 14, 11:40 AM</span></div>
        <div><Check size={13} style={{ color: "#16a34a", display: "inline" }} /> <strong>Deposited</strong> <span style={{ color: "#94a3b8" }}>May 14, 11:47 AM</span></div>
        <div><Check size={13} style={{ color: "#16a34a", display: "inline" }} /> <strong style={{ color: "#16a34a" }}>Funded</strong> <span style={{ color: "#94a3b8" }}>May 14, 11:47 AM</span></div>
        <div style={{ color: "#94a3b8" }}>○ In review <span>—</span></div>
        <div style={{ color: "#94a3b8" }}>○ Released <span>—</span></div>
        <div style={{ color: "#94a3b8" }}>○ Completed <span>—</span></div>
      </div>
    ),
  },
  {
    title: "Delivery room",
    icon: GitBranch,
    color: "#8b5cf6",
    preview: (
      <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
        <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 11, color: "#94a3b8" }}>
          <span style={{ borderBottom: "2px solid #2563eb", color: "#2563eb", fontWeight: 600, paddingBottom: 4 }}>Activity</span>
          <span>Files</span>
          <span>Git</span>
          <span>Notes</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Freelancer pushed changes</span>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>1:02 PM</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span><Check size={12} style={{ color: "#16a34a", display: "inline" }} /> CI checks passed</span>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>1:04 PM</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Client requested review</span>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>1:15 PM</span>
        </div>
      </div>
    ),
  },
];

const bulletPoints = [
  { icon: Shield, text: "Deterministic escrow logic" },
  { icon: FileText, text: "Milestone rules you control" },
  { icon: Eye, text: "Transparent decision trails" },
  { icon: Check, text: "Audit-ready by default" },
];

export function Automation() {
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotion();

  return (
    <section
      id="automation"
      style={{
        padding: "120px 0 80px",
        borderTop: "1px solid var(--line)",
      }}
    >
      <div className="section-shell">
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 64, marginBottom: 48, alignItems: "start" }}>
          <div>
            <span className="panel-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "#2563eb" }}>
              Automation Showcase
            </span>
            <RevealText as="h2" className="section-title" style={{ fontSize: 42, lineHeight: 1.1 }}>
              Automation without hiding the{" "}
              <span style={{ color: "var(--brand)" }}>reasoning.</span>
            </RevealText>
            <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.7, margin: "16px 0 28px", maxWidth: 340 }}>
              Every action is traceable. Every state change is explained.
            </p>

            {/* Bullet points */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {bulletPoints.map((bp) => {
                const Icon = bp.icon;
                return (
                  <div key={bp.text} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#475569" }}>
                    <Icon size={16} style={{ color: "var(--brand)" }} />
                    {bp.text}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Showcase panels */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 16,
            }}
          >
            {showcasePanels.map((panel) => {
              const Icon = panel.icon;
              return (
                <motion.div
                  key={panel.title}
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: reducedMotion ? 0 : 0.4 }}
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    background: "var(--canvas)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "14px 16px",
                      borderBottom: "1px solid var(--line)",
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#0f172a",
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: panel.color, display: "inline-block" }} />
                    {panel.title}
                  </div>
                  <div style={{ padding: 16 }}>
                    {panel.preview}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Automation rule example */}
        <div
          style={{
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: "20px 24px",
            background: "var(--canvas)",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
            Automation rule (example)
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1fr 1fr 1fr",
              gap: 24,
              alignItems: "start",
            }}
          >
            {/* Rule */}
            <div style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 13, lineHeight: 1.8, color: "#475569" }}>
              <div><span style={{ color: "#94a3b8", fontWeight: 700 }}>IF</span>    all( code_pushed, checks_passed, client_review_requested )</div>
              <div><span style={{ color: "#94a3b8", fontWeight: 700 }}>THEN</span>  advance_state( <span style={{ color: "#16a34a" }}>'in_review'</span> ) AND  notify( client )</div>
            </div>

            {/* Evaluation */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 8 }}>
                Evaluation
              </div>
              {["code_pushed", "checks_passed", "client_review_requested"].map((cond) => (
                <div key={cond} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", padding: "3px 0" }}>
                  <Check size={14} style={{ color: "#16a34a" }} />
                  {cond}
                  <span style={{ marginLeft: "auto", color: "#16a34a", fontWeight: 600 }}>true</span>
                </div>
              ))}
            </div>

            {/* Decision */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 8 }}>
                Decision
              </div>
              <div style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                advance_state( in_review )<br />
                notify( client )
              </div>
            </div>

            {/* Result */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8", marginBottom: 8 }}>
                Result
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>
                State updated
              </div>
              <span style={{
                display: "inline-block",
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 12,
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                color: "#16a34a",
              }}>
                In review
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
