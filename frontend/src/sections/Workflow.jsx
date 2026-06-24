import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  CircleDollarSign,
  FileText,
  Link2,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { workflowPhases } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

const lanes = [
  {
    label: "Client",
    icon: UserRound,
    active: ["brief", "agreement", "approval"],
  },
  {
    label: "FixFlowAI",
    icon: ShieldCheck,
    active: ["brief", "match", "agreement", "outcome"],
  },
  {
    label: "Talent",
    icon: BadgeCheck,
    active: ["match", "agreement", "build", "approval"],
  },
  {
    label: "Escrow",
    icon: CircleDollarSign,
    active: ["agreement", "build", "approval", "outcome"],
  },
];

export function Workflow() {
  const phase = useLandingStore((state) => state.workflowPhase);
  const setPhase = useLandingStore((state) => state.setWorkflowPhase);
  const reducedMotion = useReducedMotion();
  const activeIndex = workflowPhases.findIndex((item) => item.id === phase);
  const active = workflowPhases[activeIndex];

  return (
    <section className="workflow section-band" id="workflow">
      <div className="section-shell">
        <SectionHeading
          index="04"
          title="One workspace keeps the deal honest."
          copy="The brief, proof, agreement, delivery, payment state, and outcome stay connected instead of becoming six separate records."
        />

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

        <div className="workflow-canvas-wrap">
          <div className="workflow-canvas" aria-label="Shared project swimlane">
            <div className="workflow-axis" aria-hidden="true">
              <span />
              {workflowPhases.map((item) => (
                <strong
                  className={phase === item.id ? "is-active" : ""}
                  key={item.id}
                >
                  {item.label}
                </strong>
              ))}
            </div>
            {lanes.map((lane) => {
              const LaneIcon = lane.icon;
              return (
                <div className="workflow-lane" key={lane.label}>
                  <div className="workflow-lane-name">
                    <LaneIcon aria-hidden="true" size={17} strokeWidth={1.8} />
                    <strong>{lane.label}</strong>
                  </div>
                  {workflowPhases.map((item) => {
                    const participates = lane.active.includes(item.id);
                    const selected = phase === item.id;
                    return (
                      <button
                        className={`workflow-node${participates ? " has-event" : ""}${selected ? " is-selected" : ""}`}
                        key={item.id}
                        type="button"
                        tabIndex={participates ? 0 : -1}
                        disabled={!participates}
                        aria-label={`${lane.label}: ${item.label}${participates ? " event" : " no event"}`}
                        onClick={() => participates && setPhase(item.id)}
                      >
                        {participates ? <span /> : <i />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
            <div
              className="workflow-marker"
              style={{ "--phase-index": activeIndex }}
              aria-hidden="true"
            />
          </div>
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
