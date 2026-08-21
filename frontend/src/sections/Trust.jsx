import { Check, FileCheck2, Link2, LockKeyhole, ShieldCheck } from "lucide-react";
import { RevealText } from "../components/RevealText";
import { trustEvents } from "../data/landing";

const eventIcons = [FileCheck2, ShieldCheck, Link2, Check, LockKeyhole, FileCheck2, Check, ShieldCheck];

export function Trust() {
  return (
    <section className="landing-section trust-section" id="trust">
      <div className="section-shell trust-layout">
        <div className="trust-copy">
          <span className="landing-index">06 / Evidence trail</span>
          <RevealText as="h2" className="section-title">
            Trust is not a profile badge. It is a trail.
          </RevealText>
          <p className="section-copy">
            Every important claim points back to a source, decision, acceptance
            event, or completed outcome—visible to both sides.
          </p>
          <div className="trust-principles" aria-label="Trust principles">
            <span>Source-linked proof</span>
            <span>Explicit acceptance</span>
            <span>Protected funds</span>
            <span>Shared history</span>
          </div>
        </div>
        <div className="trust-trail-wrap">
          <p className="interface-example-label">Interface example · Billing migration</p>
          <ol className="trust-trail">
            {trustEvents.map(([title, detail], index) => {
              const Icon = eventIcons[index];
              return (
                <li key={title}>
                  <span className="trust-event-index">0{index + 1}</span>
                  <span className="trust-event-icon"><Icon aria-hidden="true" size={16} /></span>
                  <div><strong>{title}</strong><p>{detail}</p></div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="section-shell">
        <div className="section-screen" aria-label="Product interface: Verified outcome record">
          <div className="section-screen-bar" aria-hidden="true">
            <span /><span /><span />
          </div>
          <img
            src="/product-screens/fixflow-outcome-evidence-v1.png"
            alt="FixFlowAI verified outcome record showing accepted deliverables, evidence timeline from requirement capture through acceptance, source connections, and reputation reuse controls"
            loading="lazy"
            width="1340"
            height="856"
          />
        </div>
      </div>
    </section>
  );
}
