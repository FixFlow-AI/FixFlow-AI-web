import {
  Check,
  Code2,
  Users,
  FileCheck2,
  Briefcase,
  Calendar,
  GitBranch,
  ArrowRight,
} from "lucide-react";

const requirements = [
  { icon: Check, label: "Preserve subscription state" },
  { icon: Users, label: "Idempotent webhook processing" },
  { icon: GitBranch, label: "Tested rollback plan" },
  { icon: Briefcase, label: "Billing reconciliation" },
  { icon: Calendar, label: "Six-week delivery window" },
];

const evidenceNodes = [
  { type: "source", icon: Code2, label: "Repository:", sub: "billing-migration" },
  { type: "source", icon: Users, label: "Webhook:", sub: "payment webhook handler" },
  { type: "source", icon: Briefcase, label: "Job:", sub: "billing reconciliation" },
  { type: "target", icon: FileCheck2, label: "Outcome:", sub: "subscription cutover" },
  { type: "target", icon: Check, label: "Artifact:", sub: "rollback test suite" },
  { type: "target", icon: FileCheck2, label: "Delivery record:", sub: "5-week migration" },
  { type: "ref", icon: Users, label: "Reference:", sub: "platform engineering lead" },
];

const confidenceItems = [
  { label: "Subscription state", badge: "Strong evidence", color: "green" },
  { label: "Webhook reliability", badge: "Strong evidence", color: "green" },
  { label: "Rollback design", badge: "Relevant evidence", color: "blue" },
  { label: "Reconciliation", badge: "Relevant evidence", color: "blue" },
  { label: "Target runtime", badge: "Open question", color: "orange" },
];

export function EvidenceConfidence() {
  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>
          Atlas Commerce / Northstar Billing Migration
        </p>
        <h1 className="panel-page-title">Evidence connected to requirements</h1>
        <p className="panel-page-subtitle">
          Northline Studio · Review before shortlist
        </p>
      </div>

      {/* Three-column grid */}
      <div className="panel-grid panel-grid--3">
        {/* Left: Requirements */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Requirements</h2>
          </div>

          {requirements.map((req) => {
            const Icon = req.icon;
            return (
              <div
                key={req.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px 0",
                  borderBottom: "1px solid #f1f5f9",
                }}
              >
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#eff6ff",
                    border: "1.5px solid #bfdbfe",
                    display: "grid",
                    placeItems: "center",
                    color: "#2563eb",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <span style={{ fontSize: 14, fontWeight: 500, color: "#334155" }}>
                  {req.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Center: Evidence relationships */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Evidence relationships</h2>
          </div>

          {/* Visual evidence graph representation */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              padding: "8px 0",
            }}
          >
            {/* Source nodes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {evidenceNodes
                .filter((n) => n.type === "source")
                .map((node) => {
                  const NIcon = node.icon;
                  return (
                    <div
                      key={node.label + node.sub}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        border: "1px solid #e2e8f0",
                        borderRadius: 8,
                        background: "#fff",
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: "#eff6ff",
                          display: "grid",
                          placeItems: "center",
                          color: "#2563eb",
                          flexShrink: 0,
                        }}
                      >
                        <NIcon size={14} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                          {node.label}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                          {node.sub}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Target nodes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {evidenceNodes
                .filter((n) => n.type === "target" || n.type === "ref")
                .map((node) => {
                  const NIcon = node.icon;
                  return (
                    <div
                      key={node.label + node.sub}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        border: `1px solid ${node.type === "ref" ? "#e2e8f0" : "#e2e8f0"}`,
                        borderRadius: 8,
                        background: "#fff",
                        borderStyle: node.type === "ref" ? "dashed" : "solid",
                      }}
                    >
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          background: node.type === "ref" ? "#f8fafc" : "#f0fdf4",
                          display: "grid",
                          placeItems: "center",
                          color: node.type === "ref" ? "#64748b" : "#16a34a",
                          flexShrink: 0,
                        }}
                      >
                        <NIcon size={14} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b" }}>
                          {node.label}
                        </div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>
                          {node.sub}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Connection lines indicator */}
          <div
            style={{
              textAlign: "center",
              padding: "8px 0",
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 600,
            }}
          >
            — Connected via 7 evidence links —
          </div>
        </div>

        {/* Right: Confidence by requirement */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Confidence by requirement</h2>
          </div>

          {confidenceItems.map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 0",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background:
                      item.color === "green"
                        ? "#f0fdf4"
                        : item.color === "blue"
                        ? "#eff6ff"
                        : "#fff7ed",
                    border: `1.5px solid ${
                      item.color === "green"
                        ? "#86efac"
                        : item.color === "blue"
                        ? "#93c5fd"
                        : "#fdba74"
                    }`,
                    display: "grid",
                    placeItems: "center",
                    color:
                      item.color === "green"
                        ? "#16a34a"
                        : item.color === "blue"
                        ? "#2563eb"
                        : "#ea580c",
                    flexShrink: 0,
                  }}
                >
                  <Check size={13} strokeWidth={2.5} />
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                  {item.label}
                </span>
              </div>
              <span
                className={`panel-badge panel-badge--${item.color}`}
                style={{ flexShrink: 0, fontSize: 11 }}
              >
                {item.badge}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#2563eb" }}>ℹ</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Confidence is based on relevance, source strength, recency, and unresolved risk.
          </span>
        </div>
        <div className="panel-action-bar-right">
          <button type="button" className="panel-btn">
            Add to shortlist
          </button>
          <button type="button" className="panel-btn--ghost panel-btn">
            Generate focused interview
          </button>
        </div>
      </div>
    </div>
  );
}
