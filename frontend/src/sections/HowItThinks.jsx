import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, FileText, Code2, Users, Target, Shield, LayoutDashboard } from "lucide-react";
import { RevealText } from "../components/RevealText";

const steps = [
  {
    num: 1,
    label: "Intake",
    file: "input.md",
    preview: "Need a web app for client onboarding...",
    desc: "Receive request, attachments, and context.",
    icon: FileText,
  },
  {
    num: 2,
    label: "Parse",
    file: "parsed.json",
    preview: '{"type":"web_app", "flows":["onboarding", "verification",...]}',
    desc: "Extract intent, constraints, and signals.",
    icon: Code2,
  },
  {
    num: 3,
    label: "Match",
    file: "matches.graph",
    preview: null,
    desc: "Map to verified profiles and outcomes.",
    icon: Users,
  },
  {
    num: 4,
    label: "Compose",
    file: "scope.yaml",
    preview: "milestones:\n  - id: m1\n    estimate: 2w\n  - id: m2\n    estimate: 1.5w",
    desc: "Build plan, estimates, and dependencies.",
    icon: Target,
  },
  {
    num: 5,
    label: "Lock funds",
    file: "escrow.lock",
    preview: "milestones: 3\ntotal: $24,000\nrelease: by_milestone\nstatus: locked\nprotection: on",
    desc: "Funds are protected in escrow before kickoff.",
    icon: Shield,
  },
  {
    num: 6,
    label: "Workspace",
    file: "workspace.md",
    preview: null,
    desc: "Shared workspace for collaboration and delivery.",
    icon: LayoutDashboard,
  },
];

export function HowItThinks() {
  const reducedMotion = useReducedMotion();

  return (
    <section
      style={{
        padding: "100px 0 80px",
        borderTop: "1px solid var(--line)",
      }}
    >
      <div className="section-shell">
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <span className="panel-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)", display: "inline-block" }} />
            How It Thinks
          </span>
          <RevealText as="h2" className="section-title" style={{ fontSize: 42, lineHeight: 1.1, maxWidth: 480 }}>
            From raw request to{" "}
            <span style={{ color: "var(--brand)" }}>protected execution.</span>
          </RevealText>
          <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.7, maxWidth: 440, margin: "16px 0 0" }}>
            Every step is observable, explainable, and designed to reduce risk before work begins.
          </p>
        </div>

        {/* Pipeline steps */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 0,
          }}
        >
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: reducedMotion ? 0 : 0.4, delay: reducedMotion ? 0 : idx * 0.07 }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  position: "relative",
                }}
              >
                {/* Step header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    paddingRight: 16,
                    marginBottom: 16,
                  }}
                >
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--brand)",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {step.num}
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                    {step.label}
                  </span>
                  {idx < steps.length - 1 && (
                    <ArrowRight size={16} style={{ color: "var(--line-strong)", marginLeft: "auto" }} />
                  )}
                </div>

                {/* Card */}
                <div
                  style={{
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: 14,
                    background: "var(--canvas)",
                    marginRight: idx < steps.length - 1 ? 16 : 0,
                    flex: 1,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
                    <Icon size={14} style={{ color: "var(--brand)" }} />
                    {step.file}
                  </div>
                  {step.preview ? (
                    <pre style={{
                      margin: 0,
                      fontSize: 11,
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                      color: "#475569",
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                      overflow: "hidden",
                      maxHeight: 96,
                    }}>
                      {step.preview}
                    </pre>
                  ) : step.num === 3 ? (
                    /* Graph dots */
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", padding: "12px 0" }}>
                      {[24, 20, 16, 22, 18].map((s, i) => (
                        <span
                          key={i}
                          style={{
                            width: s,
                            height: s,
                            borderRadius: "50%",
                            background: i < 2 ? "var(--brand)" : "#dbeafe",
                            opacity: 0.6 + i * 0.08,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    /* Checklist */
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {["Kickoff", "Milestone 1", "Milestone 2", "Milestone 3"].map((item) => (
                        <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                          <span style={{ width: 14, height: 14, border: "1.5px solid var(--line-strong)", borderRadius: 3, flexShrink: 0 }} />
                          {item}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Description */}
                <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5, margin: "12px 0 0", paddingRight: 16 }}>
                  {step.desc}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
