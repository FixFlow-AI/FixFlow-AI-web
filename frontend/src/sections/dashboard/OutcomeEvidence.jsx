import {
  Check,
  AlertTriangle,
  Link2,
  FileText,
  Handshake,
  Award,
  Clock,
  ArrowRight,
  ArrowUpRight,
  Eye,
  Shield,
  Sparkles,
  ToggleLeft,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";

export function OutcomeEvidence() {
  const { user, parsedProposal } = useLandingStore();

  if (!parsedProposal) {
    return (
      <div>
        <div className="panel-page-header">
          <h1 className="panel-page-title">Verified outcome record</h1>
          <p className="panel-page-subtitle">
            Immutable proof trails for escrow milestones and reputation.
          </p>
        </div>
        <div className="panel-card" style={{ textAlign: "center", padding: 48 }}>
          <FileText size={32} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "12px 0 4px" }}>
            No verified outcomes yet
          </h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>
            Please parse a project brief first to begin tracking outcomes.
          </p>
        </div>
      </div>
    );
  }

  const projectTitle = parsedProposal.project_summary
    ? parsedProposal.project_summary.split(".")[0].slice(0, 80)
    : "Active Project";

  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <h1 className="panel-page-title">Verified outcome record</h1>
        <p className="panel-page-subtitle">
          {projectTitle} · <span style={{ color: "#2563eb", fontWeight: 600 }}>Awaiting execution evidence</span>
        </p>
      </div>

      {/* Three-column grid */}
      <div className="panel-grid panel-grid--3">
        {/* Left: Accepted outcome */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Accepted outcomes</h2>
          </div>

          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6, margin: "0 0 16px" }}>
            Once escrow milestones are completed and accepted, they will be listed here along with their cryptographic proof blocks.
          </p>
        </div>

        {/* Center: Evidence timeline */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Evidence timeline</h2>
          </div>

          <p style={{ fontSize: 13, color: "#64748b", textAlign: "center", padding: "40px 0" }}>
            No cryptographic evidence blocks recorded yet. Link commits and pull requests in Delivery Control to begin building the proof trail.
          </p>
        </div>

        {/* Right: Reputation and reuse */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Reputation & SBTs</h2>
          </div>

          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Award size={18} strokeWidth={1.8} style={{ color: "#64748b" }} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Claim SBT proof</span>
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0, lineHeight: 1.5 }}>
              Mint Soulbound Reputation Tokens (SBTs) on Polygon after successful milestone completion.
            </p>
          </div>

          <div className="panel-info-row">
            <span className="panel-info-label">Active SBT DID</span>
            <span className="panel-info-value">Awaiting completion</span>
          </div>
          <div className="panel-info-row">
            <span className="panel-info-label">Visibility</span>
            <span className="panel-info-value">Public</span>
          </div>

          <hr className="panel-divider" />

          {/* Toggle controls */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Use for future recommendations</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                Allow FixFlowAI to surface this proof in matching.
              </div>
            </div>
            <button type="button" className="panel-toggle is-on" aria-label="Toggle recommendations" />
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Show project name publicly</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                Hide project name when shared externally.
              </div>
            </div>
            <button type="button" className="panel-toggle" aria-label="Toggle public name" />
          </div>
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#2563eb" }}>ℹ</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Trust is a trail of sources, decisions, delivery evidence, and accepted outcomes.
          </span>
        </div>
      </div>
    </div>
  );
}
