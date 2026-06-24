import { useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDownRight, Check, CircleDot, Link2 } from "lucide-react";
import { SectionHeading } from "../components/SectionHeading";
import { thinkingSteps } from "../data/landing";

gsap.registerPlugin(ScrollTrigger);

export function HowItThinks() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const active = thinkingSteps[activeIndex];
  const ActiveIcon = active.icon;

  useLayoutEffect(() => {
    const section = sectionRef.current;
    if (
      !section ||
      reducedMotion ||
      window.matchMedia("(max-width: 899px)").matches
    )
      return undefined;

    const context = gsap.context(() => {
      const steps = gsap.utils.toArray("[data-thinking-step]");
      steps.forEach((step, index) => {
        ScrollTrigger.create({
          trigger: step,
          start: "top 58%",
          end: "bottom 42%",
          onEnter: () => setActiveIndex(index),
          onEnterBack: () => setActiveIndex(index),
        });
      });
    }, section);

    return () => context.revert();
  }, [reducedMotion]);

  return (
    <section className="thinking section-shell" id="thinking" ref={sectionRef}>
      <SectionHeading
        index="03"
        title="From raw request to protected execution."
        copy="The system keeps its reasoning visible as the project moves from intake to an outcome record."
      />

      <div className="thinking-layout">
        <div
          className="thinking-steps"
          role="tablist"
          aria-label="Execution reasoning stages"
        >
          {thinkingSteps.map((step, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                className={`thinking-step${isActive ? " is-active" : ""}`}
                key={step.label}
                data-thinking-step
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls="thinking-canvas"
                  onClick={() => setActiveIndex(index)}
                >
                  <span>0{index + 1}</span>
                  <strong>{step.label}</strong>
                  <ArrowDownRight aria-hidden="true" size={18} />
                </button>
                <p>{step.description}</p>
              </div>
            );
          })}
        </div>

        <div className="thinking-sticky">
          <motion.div
            className="thinking-canvas"
            id="thinking-canvas"
            role="tabpanel"
            key={active.label}
            initial={{ opacity: 0, y: reducedMotion ? 0 : 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.38 }}
          >
            <div className="thinking-canvas-top">
              <span className="thinking-icon">
                <ActiveIcon aria-hidden="true" size={22} strokeWidth={1.7} />
              </span>
              <span>
                Stage 0{activeIndex + 1} / 0{thinkingSteps.length}
              </span>
              <span className="thinking-live">
                <i /> Reasoning visible
              </span>
            </div>
            <div className="thinking-canvas-copy">
              <span className="inspector-label">{active.label}</span>
              <h3>{active.title}</h3>
              <p>{active.description}</p>
            </div>
            <div className="thinking-output">
              <div>
                <span className="thinking-output-icon">
                  <CircleDot aria-hidden="true" size={16} />
                </span>
                <small>Signal</small>
                <strong>{active.signal}</strong>
              </div>
              <Link2 aria-hidden="true" size={18} />
              <div>
                <span className="thinking-output-icon thinking-output-icon--verified">
                  <Check aria-hidden="true" size={16} />
                </span>
                <small>Output</small>
                <strong>{active.output}</strong>
              </div>
            </div>
            <div className="thinking-progress" aria-hidden="true">
              <span
                style={{
                  width: `${((activeIndex + 1) / thinkingSteps.length) * 100}%`,
                }}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
