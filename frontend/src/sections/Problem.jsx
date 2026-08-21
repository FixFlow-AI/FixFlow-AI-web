import { RevealText } from "../components/RevealText";
import { audiences } from "../data/landing";
import { useLandingStore } from "../store/useLandingStore";

export function Problem() {
  const audience = useLandingStore((state) => state.audience);
  const setAudience = useLandingStore((state) => state.setAudience);
  const active = audiences.find((item) => item.id === audience) || audiences[0];

  return (
    <section className="landing-section landing-problem" id="problem">
      <div className="section-shell">
        <div className="landing-heading">
          <span className="landing-index">01 / The problem</span>
          <RevealText as="h2" className="section-title">
            The old marketplace makes everyone do the wrong work.
          </RevealText>
          <p className="section-copy">
            Clients sort noise. Independent talent repeats proof. Agencies rebuild
            process. Engineering work gets reduced to profile language.
          </p>
        </div>
        <div className="audience-ledger" role="tablist" aria-label="Choose your perspective">
          {audiences.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={audience === item.id ? "is-active" : ""}
                key={item.id}
                type="button"
                role="tab"
                aria-selected={audience === item.id}
                onClick={() => setAudience(item.id)}
              >
                <span className="audience-ledger-number">0{audiences.indexOf(item) + 1}</span>
                <Icon aria-hidden="true" size={18} />
                <strong>{item.title}</strong>
                <span>{item.burden}</span>
              </button>
            );
          })}
        </div>

        <div className="audience-shift" role="tabpanel" aria-live="polite">
          <div><span>Current burden</span><p>{active.burden}</p></div>
          <div className="audience-shift-arrow" aria-hidden="true">→</div>
          <div><span>FixFlowAI shift</span><p>{active.shift}</p></div>
          <div className="audience-outcome"><span>Result</span><p>{active.outcome}</p></div>
        </div>
      </div>
    </section>
  );
}
