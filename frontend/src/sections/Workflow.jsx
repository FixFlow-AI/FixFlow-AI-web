import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Building2, CircleDollarSign, ShieldCheck, UserRound } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { workflowPhases } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

const lanes = [
  { label: "Client", icon: UserRound, phases: ["brief", "agreement", "approval", "outcome"] },
  { label: "FixFlowAI", icon: ShieldCheck, phases: ["brief", "match", "agreement", "build", "approval", "outcome"] },
  { label: "Talent", icon: Building2, phases: ["match", "agreement", "build", "approval", "outcome"] },
  { label: "Escrow", icon: CircleDollarSign, phases: ["agreement", "build", "approval", "outcome"] },
];

export function Workflow() {
  const phase = useLandingStore((state) => state.workflowPhase);
  const setPhase = useLandingStore((state) => state.setWorkflowPhase);
  const reducedMotion = useReducedMotion();
  const activeIndex = workflowPhases.findIndex((item) => item.id === phase);
  const active = workflowPhases[activeIndex];

  return (
    <section className="landing-section workflow-section" id="workflow">
      <div className="section-shell">
        <div className="landing-heading landing-heading--split">
          <span className="landing-index">04 / Shared workflow</span>
          <RevealText as="h2" className="section-title">
            One workspace keeps the deal honest.
          </RevealText>
          <p className="section-copy">
            Briefs, proof, scope, approvals, delivery, and protected funds stay
            in one causally connected record.
          </p>
        </div>
        <div className="workflow-board-scroll" tabIndex="0" aria-label="Project workflow board">
          <div className="workflow-board">
            <div className="workflow-corner">Participants</div>
            {workflowPhases.map((item, index) => (
              <button
                className={phase === item.id ? "is-active workflow-phase-head" : "workflow-phase-head"}
                key={item.id}
                type="button"
                onClick={() => setPhase(item.id)}
              >
                <span>0{index + 1}</span>{item.label}
              </button>
            ))}

            {lanes.map((lane) => {
              const Icon = lane.icon;
              return (
                <div className="workflow-lane-row" key={lane.label}>
                  <div className="workflow-lane-label"><Icon aria-hidden="true" size={16} /><strong>{lane.label}</strong></div>
                  {workflowPhases.map((item) => (
                    <button
                      className={`${lane.phases.includes(item.id) ? "has-event" : ""}${phase === item.id ? " is-active" : ""}`}
                      key={item.id}
                      type="button"
                      aria-label={`${lane.label}, ${item.label}`}
                      onClick={() => setPhase(item.id)}
                    >{lane.phases.includes(item.id) ? <span /> : null}</button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            className="workflow-detail"
            key={active.id}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -6 }}
            transition={{ duration: reducedMotion ? 0 : 0.22 }}
            aria-live="polite"
          >
            <span className="workflow-detail-index">0{activeIndex + 1}</span>
            <div><span className="inspector-label">{active.label}</span><h3>{active.title}</h3><p>{active.description}</p></div>
            <dl><div><dt>Status</dt><dd>{active.status}</dd></div><div><dt>Owner</dt><dd>{active.owner}</dd></div><div><dt>Evidence</dt><dd>{active.evidence}</dd></div></dl>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
