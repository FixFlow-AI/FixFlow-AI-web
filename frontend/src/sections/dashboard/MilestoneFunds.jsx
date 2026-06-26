import {
  Check,
  ArrowRight,
  Upload,
  FileCheck2,
  Shield,
  Wallet,
  Clock,
  AlertCircle,
} from "lucide-react";

const fundingSteps = [
  { label: "Approved", time: "May 8, 9:41 AM", done: true },
  { label: "Funding confirmed", time: "May 8, 10:05 AM", done: true },
  { label: "Work in progress", time: "May 8, 11:32 AM", active: true },
  { label: "Submitted", time: "—" },
  { label: "Accepted", time: "—" },
  { label: "Released", time: "—" },
];

const milestones = [
  {
    num: "01",
    title: "Migration plan and rollback design",
    desc: "Design migration approach and rollback strategy",
    funding: "Funded",
    fundingNote: "Escrowed",
    status: "Released",
    statusTime: "May 8, 2:15 PM",
    progress: 3,
    total: 3,
    progressLabel: "3 acceptance criteria met",
    amount: "$12,000",
    amountNote: "Released",
    progressColor: "#16a34a",
  },
  {
    num: "02",
    title: "Webhook and reconciliation implementation",
    desc: "Build webhook handler and reconciliation logic",
    funding: "Funded",
    fundingNote: "Escrowed",
    status: "Work in progress",
    statusTime: "Started May 8",
    progress: 2,
    total: 4,
    progressLabel: "2 criteria evidenced",
    amount: "$18,000",
    amountNote: "In escrow",
    progressColor: "#2563eb",
  },
  {
    num: "03",
    title: "Production cutover and acceptance",
    desc: "Cutover execution and final acceptance",
    funding: "Not funded",
    fundingNote: "Pending",
    status: "Not started",
    statusTime: "Begins after M02",
    progress: 0,
    total: 3,
    progressLabel: "Awaiting start",
    amount: "$15,000",
    amountNote: "Not funded",
    progressColor: "#cbd5e1",
  },
];

const whatChanges = [
  {
    icon: Upload,
    title: "Talent submits delivery evidence",
    desc: "Deliverables and proof are uploaded against the milestone.",
    color: "#2563eb",
  },
  {
    icon: FileCheck2,
    title: "Client reviews agreed criteria",
    desc: "Client verifies the evidence against acceptance criteria.",
    color: "#2563eb",
  },
  {
    icon: Check,
    title: "Acceptance records the outcome",
    desc: "Acceptance locks the outcome and updates milestone status.",
    color: "#16a34a",
  },
  {
    icon: Shield,
    title: "Release follows the accepted milestone",
    desc: "Funds are released to the talent after acceptance is recorded.",
    color: "#ea580c",
  },
];

export function MilestoneFunds() {
  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <h1 className="panel-page-title">Protected milestone state</h1>
        <p className="panel-page-subtitle">
          Northstar Billing Migration · Agreement v2.0
        </p>
      </div>

      {/* Grid with sidebar */}
      <div className="panel-grid panel-grid--sidebar">
        {/* Left: Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Horizontal stepper */}
          <div className="panel-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "8px 0 12px",
              }}
            >
              {fundingSteps.map((step, i) => (
                <div
                  key={step.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    flex: 1,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      border: step.done
                        ? "none"
                        : step.active
                        ? "2.5px solid #2563eb"
                        : "1.5px solid #e2e8f0",
                      background: step.done
                        ? "#16a34a"
                        : step.active
                        ? "#2563eb"
                        : "#fff",
                      color: step.done || step.active ? "#fff" : "#94a3b8",
                    }}
                  >
                    {step.done ? <Check size={16} strokeWidth={3} /> : i + 1}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: step.active ? 700 : 600,
                        color: step.active ? "#2563eb" : step.done ? "#334155" : "#94a3b8",
                      }}
                    >
                      {step.label}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{step.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Milestone table */}
          <div className="panel-card" style={{ padding: 0 }}>
            {/* Table header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1.2fr 1.5fr 0.8fr",
                gap: 8,
                padding: "12px 20px",
                borderBottom: "1px solid #e2e8f0",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#94a3b8",
              }}
            >
              <span>Milestone</span>
              <span>Funding</span>
              <span>Status</span>
              <span>Acceptance progress</span>
              <span style={{ textAlign: "right" }}>Amount</span>
            </div>

            {/* Milestone rows */}
            {milestones.map((ms) => (
              <div
                key={ms.num}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr 1.2fr 1.5fr 0.8fr",
                  gap: 8,
                  padding: "16px 20px",
                  borderBottom: "1px solid #f1f5f9",
                  alignItems: "center",
                }}
              >
                {/* Title */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#2563eb",
                        minWidth: 24,
                      }}
                    >
                      {ms.num}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                        {ms.title}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{ms.desc}</div>
                    </div>
                  </div>
                </div>

                {/* Funding */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                    {ms.funding === "Funded" ? (
                      <Check size={14} style={{ color: "#16a34a" }} />
                    ) : (
                      <span style={{ width: 14, height: 14, borderRadius: "50%", border: "1.5px solid #cbd5e1", display: "inline-block" }} />
                    )}
                    <span style={{ fontWeight: 600, color: ms.funding === "Funded" ? "#334155" : "#94a3b8" }}>
                      {ms.funding}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginLeft: 18 }}>
                    {ms.fundingNote}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <span
                    className={`panel-badge ${
                      ms.status === "Released"
                        ? "panel-badge--green"
                        : ms.status === "Work in progress"
                        ? "panel-badge--blue"
                        : "panel-badge--gray"
                    }`}
                  >
                    {ms.status}
                  </span>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                    {ms.statusTime}
                  </div>
                </div>

                {/* Progress */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        background: "#f1f5f9",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${(ms.progress / ms.total) * 100}%`,
                          height: "100%",
                          background: ms.progressColor,
                          borderRadius: 3,
                          transition: "width 300ms ease",
                        }}
                      />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
                      {ms.progress} / {ms.total}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                    {ms.progressLabel}
                  </div>
                </div>

                {/* Amount */}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                    {ms.amount}
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{ms.amountNote}</div>
                </div>
              </div>
            ))}

            {/* Summary row */}
            <div
              style={{
                display: "flex",
                gap: 40,
                padding: "16px 20px",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wallet size={18} style={{ color: "#64748b" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                    Total agreement value
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                    $45,000
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Shield size={18} style={{ color: "#64748b" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                    Total in escrow
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                    $30,000
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={18} style={{ color: "#ea580c" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>
                    Awaiting release
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                    $12,000
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar: What changes this state */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">What changes this state</h2>
          </div>

          {whatChanges.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                style={{
                  display: "flex",
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
                    background:
                      item.color === "#16a34a"
                        ? "#f0fdf4"
                        : item.color === "#ea580c"
                        ? "#fff7ed"
                        : "#eff6ff",
                    display: "grid",
                    placeItems: "center",
                    color: item.color,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 2 }}>
                    {item.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
                    {item.desc}
                  </div>
                </div>
              </div>
            );
          })}

          <hr className="panel-divider" />
          <button type="button" className="panel-link">
            View funding history <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#2563eb" }}>ℹ</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>
            Funds and delivery state remain linked to the approved agreement.
          </span>
        </div>
        <div className="panel-action-bar-right">
          <button type="button" className="panel-link">
            Go to Delivery <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
