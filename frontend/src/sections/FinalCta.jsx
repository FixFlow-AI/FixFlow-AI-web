import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Lock, Play } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { useLandingStore } from "../store/useLandingStore";

export function FinalCta() {
  const audience = useLandingStore((state) => state.audience);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [source, setSource] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const reducedMotion = useReducedMotion();

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    setSubmitted(true);
  };

  return (
    <section id="early-access" className="final-cta-section">
      <div className="section-shell">
        <div className="final-cta-layout">
          {/* Left: Copy */}
          <div>
            <span className="panel-label" style={{ display: "block", marginBottom: 12, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94a3b8" }}>
              Get Started
            </span>
            <RevealText as="h2" className="section-title" style={{ fontSize: 42, lineHeight: 1.1 }}>
              Start with a brief.{" "}
              <span style={{ color: "var(--brand)" }}>Leave with a working agreement.</span>
            </RevealText>
            <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.7, margin: "20px 0 28px", maxWidth: 440 }}>
              FixFlowAI turns intent into an agreement you can trust. Human judgment stays in control. The system removes the friction.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a className="button" href="#/signup">
                Request access
                <ArrowRight aria-hidden="true" size={18} />
              </a>
              <button className="button button--quiet" type="button">
                <Play aria-hidden="true" size={17} />
                Watch the system think
              </button>
            </div>
          </div>

          {/* Right: Form */}
          <div>
            {submitted ? (
              <motion.div
                initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: 32,
                  border: "1px solid #bbf7d0",
                  borderRadius: 12,
                  background: "#f0fdf4",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    background: "#16a34a",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <Check size={24} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
                  You are on the early-access list.
                </h3>
                <p style={{ fontSize: 14, color: "#64748b" }}>
                  We will contact you with the {audience || "client"} onboarding path.
                </p>
              </motion.div>
            ) : (
              <form
                onSubmit={handleSubmit}
                style={{
                  padding: 32,
                  border: "1px solid var(--line)",
                  borderRadius: 12,
                  background: "var(--canvas)",
                }}
              >
                {/* Work email */}
                <div style={{ marginBottom: 20 }}>
                  <label
                    htmlFor="access-email"
                    style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}
                  >
                    Work email
                  </label>
                  <input
                    id="access-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    autoComplete="email"
                    required
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 14,
                      color: "#0f172a",
                    }}
                  />
                </div>

                {/* Role */}
                <div style={{ marginBottom: 20 }}>
                  <label
                    htmlFor="access-role"
                    style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}
                  >
                    I am a
                  </label>
                  <select
                    id="access-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 14,
                      color: role ? "#0f172a" : "#94a3b8",
                      background: "var(--canvas)",
                      appearance: "auto",
                    }}
                  >
                    <option value="">Select your role</option>
                    <option value="client">Client</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="agency">Agency</option>
                    <option value="developer">Developer</option>
                  </select>
                </div>

                {/* Source */}
                <div style={{ marginBottom: 24 }}>
                  <label
                    htmlFor="access-source"
                    style={{ display: "block", fontSize: 14, fontWeight: 600, color: "#0f172a", marginBottom: 6 }}
                  >
                    How did you hear about us?
                  </label>
                  <select
                    id="access-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      fontSize: 14,
                      color: source ? "#0f172a" : "#94a3b8",
                      background: "var(--canvas)",
                      appearance: "auto",
                    }}
                  >
                    <option value="">Select an option</option>
                    <option value="twitter">Twitter / X</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="referral">Referral</option>
                    <option value="search">Search</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <button
                  className="button"
                  type="submit"
                  style={{ width: "100%", justifyContent: "center" }}
                >
                  Request access
                  <ArrowRight aria-hidden="true" size={18} />
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    marginTop: 16,
                    fontSize: 12,
                    color: "#94a3b8",
                  }}
                >
                  <Lock size={12} />
                  We respect your inbox. No spam. Ever.
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
