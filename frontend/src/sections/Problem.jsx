import { motion, useReducedMotion } from "framer-motion";
import { RevealText } from "../components/RevealText";
import { audiences } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

/* Audience pain-point highlights from the concept image */
const audienceDetails = {
  client: {
    action: "screen noise.",
    lines: ["Too many profiles.", "Too little context.", "Hard to choose."],
  },
  freelancer: {
    action: "chase proof.",
    lines: ["You deliver value.", "They still ask", "for more proof."],
  },
  agency: {
    action: "rebuild scopes.",
    lines: ["Discovery repeats.", "Scopes drift.", "Margins disappear."],
  },
  developer: {
    action: "repeat onboarding.",
    lines: ["New tools. New logins.", "Context lost.", "Velocity drops."],
  },
};

export function Problem() {
  const audience = useLandingStore((s) => s.audience);
  const reducedMotion = useReducedMotion();

  return (
    <section
      className="section-band"
      id="problem"
      style={{ padding: "96px 0 88px" }}
    >
      <div className="section-shell">
        {/* Layout: title left, audience columns right */}
        <div className="ff-split-1-2" style={{ gap: 64, alignItems: "start" }}>
          {/* Left: Headline */}
          <div>
            <RevealText
              as="h2"
              className="section-title"
              style={{ fontSize: 42, lineHeight: 1.1 }}
            >
              The old marketplace makes everyone do the wrong work.
            </RevealText>
          </div>

          {/* Right: Audience columns */}
          <div className="ff-4col" style={{ gap: 32 }}>
            {audiences.map((aud, idx) => {
              const detail = audienceDetails[aud.id];
              const Icon = aud.icon;
              return (
                <motion.div
                  key={aud.id}
                  initial={{ opacity: 0, y: reducedMotion ? 0 : 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{
                    duration: reducedMotion ? 0 : 0.4,
                    delay: reducedMotion ? 0 : idx * 0.08,
                  }}
                  style={{
                    borderTop: "1px solid var(--line)",
                    paddingTop: 20,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <Icon size={18} strokeWidth={1.8} style={{ color: "var(--brand)" }} />
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                      {aud.title}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "var(--brand)",
                      margin: "0 0 12px",
                    }}
                  >
                    {detail.action}
                  </p>
                  <div
                    style={{
                      fontSize: 14,
                      color: "var(--muted)",
                      lineHeight: 1.65,
                    }}
                  >
                    {detail.lines.map((line, i) => (
                      <span key={i} style={{ display: "block" }}>
                        {line}
                      </span>
                    ))}
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
