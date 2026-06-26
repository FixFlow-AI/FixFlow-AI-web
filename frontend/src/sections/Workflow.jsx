import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  CircleDollarSign,
  FileText,
  Link2,
  ShieldCheck,
  UserRound,
  Code2,
  Users,
} from "lucide-react";
import { RevealText } from "../components/RevealText";
import { workflowPhases } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

const actors = [
  { label: "Client", icon: UserRound, color: "#2563eb" },
  { label: "Freelancer", icon: BadgeCheck, color: "#16a34a" },
  { label: "Agency", icon: Users, color: "#8b5cf6" },
  { label: "Developer", icon: Code2, color: "#475569" },
];

const milestoneColumns = [
  { num: "01", label: "Brief captured", status: "Drafting" },
  { num: "02", label: "Proposal created", status: "Reviewing" },
  { num: "03", label: "Scope agreed", status: "Funded" },
  { num: "04", label: "Work in progress", status: "In review" },
  { num: "05", label: "Delivery & handoff", status: "In review" },
];

export function Workflow() {
  const phase = useLandingStore((state) => state.workflowPhase);
  const setPhase = useLandingStore((state) => state.setWorkflowPhase);
  const reducedMotion = useReducedMotion();
  const activeIndex = workflowPhases.findIndex((item) => item.id === phase);
  const active = workflowPhases[activeIndex];

  return (
    <section className="section-band" id="workflow" style={{ padding: "120px 0 80px" }}>
      <div className="section-shell">
        {/* Header */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 3fr", gap: 64, marginBottom: 48, alignItems: "start" }}>
          <div>
            <span className="panel-label" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, color: "#2563eb" }}>
              Workflow Visualization
            </span>
            <RevealText as="h2" className="section-title" style={{ fontSize: 42, lineHeight: 1.1 }}>
              One workspace keeps the deal{" "}
              <span style={{ color: "var(--brand)" }}>honest.</span>
            </RevealText>
            <p style={{ fontSize: 16, color: "var(--muted)", lineHeight: 1.7, margin: "16px 0 0", maxWidth: 340 }}>
              Proposal edits, milestone approvals, escrow state, and delivery context stay connected so nobody has to reconstruct what happened.
            </p>
          </div>

          {/* Swimlane visualization */}
          <div
            style={{
              border: "1px solid var(--line)",
              borderRadius: 12,
              background: "var(--canvas)",
              overflow: "hidden",
            }}
          >
            {/* Column headers */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px repeat(5, 1fr)",
                borderBottom: "1px solid var(--line)",
              }}
            >
              <div style={{ padding: "14px 16px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#94a3b8" }}>
                Actors
              </div>
              {milestoneColumns.map((col) => (
                <div
                  key={col.num}
                  style={{
                    padding: "14px 12px",
                    textAlign: "center",
                    borderLeft: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>{col.num}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginTop: 2 }}>{col.label}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{col.status}</div>
                </div>
              ))}
            </div>

            {/* Actor lanes */}
            {actors.map((actor) => {
              const Icon = actor.icon;
              /* Deterministic participation pattern per actor */
              const participation = {
                Client: [true, false, true, false, true],
                Freelancer: [false, true, true, true, true],
                Agency: [false, false, true, true, false],
                Developer: [false, true, false, true, true],
              }[actor.label] || [true, true, true, true, true];

              return (
                <div
                  key={actor.label}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "140px repeat(5, 1fr)",
                    borderBottom: "1px solid var(--line)",
                    minHeight: 56,
                    alignItems: "center",
                  }}
                >
                  <div style={{ padding: "0 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon size={16} style={{ color: actor.color }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>{actor.label}</div>
                      <div style={{ fontSize: 10, color: "#16a34a", display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#16a34a", display: "inline-block" }} />
                        Active
                      </div>
                    </div>
                  </div>
                  {participation.map((active, i) => (
                    <div
                      key={i}
                      style={{
                        borderLeft: "1px solid var(--line)",
                        height: "100%",
                        display: "grid",
                        placeItems: "center",
                        position: "relative",
                      }}
                    >
                      {active && (
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: "#0f172a",
                          }}
                        />
                      )}
                      {/* Horizontal line connector */}
                      {active && i > 0 && participation[i - 1] && (
                        <span
                          style={{
                            position: "absolute",
                            left: 0,
                            top: "50%",
                            width: "50%",
                            height: 1,
                            background: "#cbd5e1",
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Bottom event labels */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "140px repeat(5, 1fr)",
                padding: "12px 0",
              }}
            >
              <div />
              {[
                { label: "Client requested changes", time: "10:42 AM" },
                { label: "Freelancer submitted revision", time: "11:03 AM" },
                { label: "Scope approved & escrow funded", time: "11:47 AM" },
                { label: "Agency requested clarification", time: "01:21 PM" },
                { label: "Delivery submitted for review", time: "02:15 PM" },
              ].map((evt) => (
                <div
                  key={evt.label}
                  style={{
                    padding: "0 12px",
                    textAlign: "center",
                    borderLeft: "1px solid var(--line)",
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", lineHeight: 1.4 }}>
                    {evt.label}
                  </div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{evt.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Phase selector + detail */}
        <div
          className="phase-control"
          role="tablist"
          aria-label="Project phases"
        >
          {workflowPhases.map((item, index) => (
            <button
              className={phase === item.id ? "is-active" : ""}
              key={item.id}
              type="button"
              role="tab"
              aria-selected={phase === item.id}
              onClick={() => setPhase(item.id)}
            >
              <span>0{index + 1}</span>
              {item.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            className="workflow-detail"
            key={active.id}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.28 }}
            aria-live="polite"
          >
            <div className="workflow-detail-main">
              <span className="section-index">0{activeIndex + 1}</span>
              <div>
                <h3>{active.title}</h3>
                <p>{active.description}</p>
              </div>
            </div>
            <div className="workflow-detail-meta">
              <span>
                <ShieldCheck aria-hidden="true" size={16} /> Status
                <strong>{active.status}</strong>
              </span>
              <span>
                <UserRound aria-hidden="true" size={16} /> Owner
                <strong>{active.owner}</strong>
              </span>
              <span>
                <FileText aria-hidden="true" size={16} /> Evidence
                <strong>{active.evidence}</strong>
              </span>
            </div>
            <Link2
              className="workflow-detail-link"
              aria-hidden="true"
              size={18}
            />
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
