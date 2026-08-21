import { RevealText } from "../components/RevealText";

export function SkillProfileShowcase() {
  return (
    <section className="skill-profile-showcase" aria-label="Evidence-based skill verification">
      <div className="section-shell">
        <div className="skill-profile-copy">
          <span className="landing-index">Evidence, not résumés</span>
          <RevealText as="h2" className="section-title">
            Skills verified from what you actually built.
          </RevealText>
          <p className="section-copy">
            FixFlowAI scans repositories, commits, and project outcomes to build
            a proof-backed skill profile — replacing self-reported claims with
            evidence clients can inspect before hiring.
          </p>
        </div>
        <div className="section-screen">
          <div className="section-screen-bar" aria-hidden="true">
            <span /><span /><span />
          </div>
          <img
            src="/product-screens/github-skill-page.png"
            alt="FixFlowAI skill verification page showing a developer profile with 78% verified skill score, language distribution, scanned projects, and experience signals"
            loading="lazy"
            width="1340"
            height="856"
          />
        </div>
      </div>
    </section>
  );
}
