import { motion, useReducedMotion } from "framer-motion";
import { Check, Shield, Layers, Lock, History } from "lucide-react";
import { RevealText } from "../components/RevealText";

const trustPillars = [
  { icon: Check, label: "Verified work" },
  { icon: Layers, label: "Stable scope" },
  { icon: Lock, label: "Protected funds" },
  { icon: History, label: "Shared history" },
];

const trustTrailCards = [
  {
    time: "09:14 AM",
    icon: Check,
    title: "Skill verified",
    subtitle: "React · TypeScript",
    hash: "7f3a...c91b",
    color: "#16a34a",
    position: { bottom: "10%", left: "40%" },
  },
  {
    time: "09:47 AM",
    icon: Layers,
    title: "Scope updated",
    subtitle: "Milestones · Dates · Deliverables",
    hash: "2b9d...a71e",
    color: "#2563eb",
    position: { top: "35%", left: "38%" },
  },
  {
    time: "10:21 AM",
    icon: Shield,
    title: "Client approved",
    subtitle: "Milestone 1",
    hash: "9c1e...f02a",
    color: "#2563eb",
    position: { top: "10%", right: "30%" },
  },
  {
    time: "10:38 AM",
    icon: Lock,
    title: "Milestone paid",
    subtitle: "Escrow released",
    hash: "a88d...44f9",
    color: "#16a34a",
    position: { top: "5%", right: "5%" },
  },
];

export function Trust() {
  const reducedMotion = useReducedMotion();

  return (
    <section className="section-band" id="trust" style={{ padding: "120px 0 80px" }}>
      <div className="section-shell">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 64, alignItems: "start" }}>
          {/* Left: Copy */}
          <div>
            <span className="panel-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "#94a3b8", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>
              Customer Confidence
            </span>
            <RevealText as="h2" className="section-title" style={{ fontSize: 42, lineHeight: 1.1 }}>
              Trust is not a profile badge.{" "}
              <span style={{ color: "var(--brand)" }}>It is a trail.</span>
            </RevealText>
            <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.7, margin: "20px 0 36px", maxWidth: 380 }}>
              Every brief decision, skill signal, scope revision, approval, and payout becomes evidence both sides can inspect.
            </p>

            {/* Four pillars */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 20,
              }}
            >
              {trustPillars.map((pillar, idx) => {
                const Icon = pillar.icon;
                return (
                  <motion.div
                    key={pillar.label}
                    initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: reducedMotion ? 0 : 0.3, delay: reducedMotion ? 0 : idx * 0.06 }}
                    style={{ textAlign: "center" }}
                  >
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        border: "1.5px solid var(--line)",
                        display: "grid",
                        placeItems: "center",
                        margin: "0 auto 8px",
                        color: "var(--brand)",
                      }}
                    >
                      <Icon size={20} strokeWidth={1.6} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                      {pillar.label}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Right: Trail visualization */}
          <div
            style={{
              position: "relative",
              minHeight: 420,
              borderRadius: 12,
              background: "linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)",
              overflow: "hidden",
            }}
          >
            {/* Decorative curved line */}
            <svg
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              viewBox="0 0 600 420"
              fill="none"
            >
              <path
                d="M 50 380 C 150 300, 200 250, 300 200 S 450 100, 550 50"
                stroke="#bfdbfe"
                strokeWidth="2"
                strokeDasharray="6 4"
                fill="none"
              />
              {/* Dots along the curve */}
              <circle cx="150" cy="310" r="5" fill="#2563eb" />
              <circle cx="300" cy="200" r="6" fill="#2563eb" />
              <circle cx="430" cy="120" r="5" fill="#2563eb" />
              <circle cx="540" cy="55" r="6" fill="#16a34a" />
            </svg>

            {/* Floating trail event cards */}
            {trustTrailCards.map((card, idx) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: reducedMotion ? 0 : 0.5, delay: reducedMotion ? 0 : 0.2 + idx * 0.1 }}
                  style={{
                    position: "absolute",
                    ...card.position,
                    background: "#fff",
                    border: "1px solid var(--line)",
                    borderRadius: 10,
                    padding: "14px 16px",
                    boxShadow: "0 4px 16px rgba(15,23,42,0.06)",
                    minWidth: 180,
                    zIndex: idx + 1,
                  }}
                >
                  <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>{card.time}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: card.color + "15",
                        display: "grid",
                        placeItems: "center",
                        color: card.color,
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={14} />
                    </span>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{card.title}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{card.subtitle}</div>
                    </div>
                  </div>
                  <div style={{
                    marginTop: 8,
                    fontSize: 10,
                    fontFamily: "'SF Mono', 'Fira Code', monospace",
                    color: "#94a3b8",
                  }}>
                    EVIDENCE ID {card.hash}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
