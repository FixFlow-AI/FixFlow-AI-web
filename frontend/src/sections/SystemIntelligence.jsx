import { motion, useReducedMotion } from "framer-motion";
import { RevealText } from "../components/RevealText";
import { intelligenceStages } from "../data/landing";

export function SystemIntelligence() {
  const reducedMotion = useReducedMotion();

  return (
    <section id="intelligence" style={{ padding: "120px 0 80px" }}>
      <div className="section-shell">
        {/* Header + System visualization */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 2fr",
            gap: 64,
            alignItems: "start",
          }}
        >
          {/* Left: Copy + pipeline stages */}
          <div>
            <span className="panel-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)", display: "inline-block" }} />
              System Intelligence
            </span>
            <RevealText as="h2" className="section-title" style={{ fontSize: 42, lineHeight: 1.1 }}>
              System intelligence replaces marketplace{" "}
              <span style={{ color: "var(--brand)" }}>guesswork.</span>
            </RevealText>
            <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.7, margin: "20px 0 36px", maxWidth: 360 }}>
              The platform reads the brief, audits proof, predicts scope risk, and turns uncertainty into a shared plan before anyone starts work.
            </p>

            {/* Pipeline stages list */}
            <div style={{ borderLeft: "2px solid var(--line)", paddingLeft: 24 }}>
              {intelligenceStages.map((stage, i) => {
                const Icon = stage.icon;
                return (
                  <motion.div
                    key={stage.label}
                    initial={{ opacity: 0, x: reducedMotion ? 0 : -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: reducedMotion ? 0 : 0.35, delay: reducedMotion ? 0 : i * 0.08 }}
                    style={{
                      position: "relative",
                      padding: "14px 0",
                    }}
                  >
                    {/* Dot on the line */}
                    <span
                      style={{
                        position: "absolute",
                        left: -31,
                        top: 18,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: i === 0 ? "var(--brand)" : "var(--line-strong)",
                        border: "2px solid var(--canvas)",
                      }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <Icon size={16} strokeWidth={1.8} style={{ color: "var(--brand)" }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                        {stage.label}
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--muted)", margin: 0, lineHeight: 1.5 }}>
                      {stage.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right: System visualization cards */}
          <div>
            {/* Row 1: Raw brief + Parsed intelligence */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
              {/* Raw brief card */}
              <div>
                <span className="panel-label" style={{ marginBottom: 8, display: "block" }}>Raw Brief</span>
                <div style={{
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: 20,
                  background: "var(--canvas)",
                  fontSize: 14,
                  color: "#475569",
                  lineHeight: 1.7,
                }}>
                  Need a web app for client onboarding. Users sign up, verify email, complete profile, and submit docs. Admins review and approve. Use React and Node. Timeline ~ 6 weeks. Budget flexible.
                </div>
              </div>

              {/* Parsed intelligence */}
              <div>
                <span className="panel-label" style={{ marginBottom: 8, display: "block" }}>Parsed Intelligence</span>
                <div style={{
                  border: "1px solid var(--line)",
                  borderRadius: 10,
                  padding: 16,
                  background: "var(--canvas)",
                  fontFamily: "'SF Mono', 'Fira Code', monospace",
                  fontSize: 12,
                  lineHeight: 1.7,
                  color: "#475569",
                }}>
                  <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
{`{
  "type": "web_app",
  "flows": ["onboarding",
    "verification",
    "review", "approval"],
  "stack": ["react", "node"],
  "timeline": "~6 weeks",
  "budget": "flexible",
  "constraints": [],
  "signals": { "priority": "medium",
    "risk": "uncertain" }
}`}
                  </pre>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 12,
                    padding: "6px 10px",
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "inherit",
                    color: "#16a34a",
                    fontWeight: 600,
                  }}>
                    ✓ Parsed with 92% confidence
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Confidence grid */}
            <div style={{ marginBottom: 20 }}>
              <span className="panel-label" style={{ marginBottom: 8, display: "block" }}>Confidence Grid</span>
              <div style={{
                border: "1px solid var(--line)",
                borderRadius: 10,
                padding: 0,
                background: "var(--canvas)",
                overflow: "hidden",
              }}>
                {[
                  { metric: "Scope Clarity", value: "82%", color: "#2563eb" },
                  { metric: "Proof Fit", value: "91%", color: "#2563eb" },
                  { metric: "Risk Level", value: "Low", color: "#16a34a" },
                  { metric: "Overall Confidence", value: "88%", color: "#16a34a" },
                ].map((row, i) => (
                  <div
                    key={row.metric}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "12px 20px",
                      borderBottom: i < 3 ? "1px solid var(--line)" : "none",
                      fontSize: 14,
                    }}
                  >
                    <span style={{ color: "#475569", fontWeight: 500 }}>{row.metric}</span>
                    <span style={{ color: row.color, fontWeight: 700 }}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
