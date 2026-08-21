import { RevealText } from "../components/RevealText";
import { automationRows } from "../data/landing";

export function Automation() {
  return (
    <section className="landing-section automation-section" id="automation">
      <div className="section-shell">
        <div className="landing-heading landing-heading--split">
          <span className="landing-index">05 / Accountable automation</span>
          <RevealText as="h2" className="section-title">
            Automation without hiding the reasoning.
          </RevealText>
          <p className="section-copy">
            FixFlowAI handles repetition, not accountability. Every automated
            action remains reviewable and every consequential decision stays human.
          </p>
        </div>
        <div className="automation-table-wrap">
          <table className="automation-table">
            <thead>
              <tr>
                <th scope="col">Repetitive work removed</th>
                <th scope="col">Before FixFlowAI</th>
                <th scope="col">Automated behavior</th>
                <th scope="col">Human control retained</th>
              </tr>
            </thead>
            <tbody>
              {automationRows.map((row, index) => (
                <tr key={row.work}>
                  <th scope="row"><span>0{index + 1}</span>{row.work}</th>
                  <td data-label="Before">{row.before}</td>
                  <td data-label="Automated">{row.automation}</td>
                  <td data-label="You control">{row.control}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
