import { useEffect, useState } from "react";
import {
  Check,
  ArrowRight,
  Upload,
  FileCheck2,
  Shield,
  Wallet,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";
import { api, ApiError } from "../../lib/api";

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
  const { user, parsedProposal, parsedProposalId } = useLandingStore();
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadMilestones = async () => {
    if (!parsedProposalId) return;
    setLoading(true);
    setError("");
    try {
      const res = await api.listMilestones(parsedProposalId);
      setMilestones(res.milestones || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load milestones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMilestones();
  }, [parsedProposalId]);

  if (!parsedProposal) {
    return (
      <div>
        <div className="panel-page-header">
          <h1 className="panel-page-title">Protected milestone state</h1>
          <p className="panel-page-subtitle">
            Track funded milestones, escrow custody, and releases.
          </p>
        </div>
        <div className="panel-card" style={{ textAlign: "center", padding: 48 }}>
          <FileText size={32} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "12px 0 4px" }}>
            No active project milestones
          </h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>
            Please parse a project brief first to view and fund milestones.
          </p>
        </div>
      </div>
    );
  }

  const projectTitle = parsedProposal.project_summary
    ? parsedProposal.project_summary.split(".")[0].slice(0, 80)
    : "Active Project";

  const displayMilestones = milestones.length > 0
    ? milestones.map((ms, idx) => ({
        num: String(idx + 1).padStart(2, "0"),
        title: ms.title,
        desc: `Milestone ${idx + 1}`,
        funding: ms.state !== "Draft" && ms.state !== "Pending_Deposit" ? "Funded" : "Not funded",
        fundingNote: ms.state === "Funds_Released" ? "Released" : ms.state !== "Draft" && ms.state !== "Pending_Deposit" ? "Escrowed" : "Pending",
        status: ms.state === "Funds_Released" ? "Released" : ms.state === "Approved" ? "Approved" : ms.state === "Active" ? "Active" : ms.state === "In_Review" ? "In review" : ms.state,
        statusTime: "Updated dynamically",
        progress: ms.state === "Funds_Released" || ms.state === "Approved" ? 1 : 0,
        total: 1,
        progressLabel: ms.state === "Funds_Released" ? "Delivered & Released" : ms.state === "Approved" ? "Approved" : "In execution",
        amount: `$${ms.amount.toLocaleString()}`,
        amountNote: ms.state === "Funds_Released" ? "Released" : ms.state !== "Draft" && ms.state !== "Pending_Deposit" ? "In escrow" : "Not funded",
        progressColor: ms.state === "Funds_Released" ? "#16a34a" : "#2563eb",
        rawAmount: ms.amount,
        rawState: ms.state,
      }))
    : parsedProposal.timeline?.map((phase, idx) => ({
        num: String(idx + 1).padStart(2, "0"),
        title: phase.phase,
        desc: phase.tasks.join(", "),
        funding: "Not funded",
        fundingNote: "Pending",
        status: "Draft",
        statusTime: "Awaiting agreement",
        progress: 0,
        total: phase.tasks.length,
        progressLabel: "Awaiting start",
        amount: `$${(idx === 0 ? 12000 : idx === 1 ? 18000 : 15000).toLocaleString()}`,
        amountNote: "Not funded",
        progressColor: "#cbd5e1",
        rawAmount: idx === 0 ? 12000 : idx === 1 ? 18000 : 15000,
        rawState: "Draft",
      })) || [];

  const totalValue = displayMilestones.reduce((acc, m) => acc + m.rawAmount, 0);
  const totalEscrow = displayMilestones
    .filter((m) => m.rawState !== "Draft" && m.rawState !== "Pending_Deposit")
    .reduce((acc, m) => acc + m.rawAmount, 0);
  const awaitingRelease = displayMilestones
    .filter((m) => m.rawState === "Approved" || m.rawState === "In_Review")
    .reduce((acc, m) => acc + m.rawAmount, 0);

  const anyFunded = displayMilestones.some(m => m.rawState !== "Draft" && m.rawState !== "Pending_Deposit");
  const anyReleased = displayMilestones.some(m => m.rawState === "Funds_Released");
  const allReleased = displayMilestones.length > 0 && displayMilestones.every(m => m.rawState === "Funds_Released");

  const activeStep = allReleased ? 5 : anyReleased ? 4 : anyFunded ? 2 : 1;

  const fundingSteps = [
    { label: "Agreement Setup", done: true },
    { label: "Funding Confirmed", done: activeStep > 1, active: activeStep === 1 },
    { label: "Work In Progress", done: activeStep > 2, active: activeStep === 2 },
    { label: "Evidence Review", done: activeStep > 3, active: activeStep === 3 },
    { label: "Outcome Approved", done: activeStep > 4, active: activeStep === 4 },
    { label: "Funds Released", done: activeStep === 5, active: activeStep === 5 },
  ];

  return (
    <div>
      <div className="panel-page-header">
        <h1 className="panel-page-title">Protected milestone state</h1>
        <p className="panel-page-subtitle">
          {projectTitle} · Agreement v1.0
        </p>
      </div>

      <div className="panel-grid panel-grid--sidebar">
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div className="panel-card">
            <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 12px" }}>
              {fundingSteps.map((step, i) => (
                <div key={step.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flex: 1 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700, border: step.done ? "none" : step.active ? "2.5px solid #2563eb" : "1.5px solid #e2e8f0", background: step.done ? "#16a34a" : step.active ? "#2563eb" : "#fff", color: step.done || step.active ? "#fff" : "#94a3b8" }}>
                    {step.done ? <Check size={16} /> : i + 1}
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 12, fontWeight: step.active ? 700 : 600, color: step.active ? "#2563eb" : step.done ? "#334155" : "#94a3b8" }}>
                      {step.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="panel-card" style={{ padding: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1.5fr 0.8fr", gap: 8, padding: "12px 20px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#94a3b8" }}>
              <span>Milestone</span>
              <span>Funding</span>
              <span>Status</span>
              <span>Acceptance progress</span>
              <span style={{ textAlign: "right" }}>Amount</span>
            </div>

            {displayMilestones.map((ms) => (
              <div key={ms.num} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1.2fr 1.5fr 0.8fr", gap: 8, padding: "16px 20px", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{ms.num}</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{ms.title}</div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{ms.desc}</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                    {ms.funding === "Funded" && <Check size={14} style={{ color: "#16a34a" }} />}
                    <span style={{ fontWeight: 600, color: ms.funding === "Funded" ? "#334155" : "#94a3b8" }}>{ms.funding}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginLeft: 18 }}>{ms.fundingNote}</div>
                </div>
                <div>
                  <span className={`panel-badge ${ms.status === "Released" ? "panel-badge--green" : ms.status === "Work in progress" || ms.status === "Active" ? "panel-badge--blue" : "panel-badge--gray"}`}>
                    {ms.status}
                  </span>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{ms.statusTime}</div>
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: ms.total > 0 ? `${(ms.progress / ms.total) * 100}%` : "0%", height: "100%", background: ms.progressColor, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>{ms.progress} / {ms.total}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{ms.progressLabel}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{ms.amount}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{ms.amountNote}</div>
                </div>
              </div>
            ))}

            <div style={{ display: "flex", gap: 40, padding: "16px 20px", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Wallet size={18} style={{ color: "#64748b" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Total agreement value</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>${totalValue.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Shield size={18} style={{ color: "#64748b" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Total in escrow</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>${totalEscrow.toLocaleString()}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertCircle size={18} style={{ color: "#ea580c" }} />
                <div>
                  <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Awaiting release</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a" }}>${awaitingRelease.toLocaleString()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel-card">
          <div className="panel-card-header"><h2 className="panel-card-title">What changes this state</h2></div>
          {whatChanges.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} style={{ display: "flex", gap: 12, padding: "14px 0", borderBottom: "1px solid #f1f5f9" }}>
                <span style={{ width: 32, height: 32, borderRadius: "50%", background: "#eff6ff", display: "grid", placeItems: "center", color: item.color, flexShrink: 0 }}>
                  <Icon size={15} strokeWidth={1.8} />
                </span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{item.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel-action-bar">
        <div className="panel-action-bar-left" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#2563eb" }}>ℹ</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>Funds and delivery state remain linked to the approved agreement.</span>
        </div>
        <div className="panel-action-bar-right">
          <button type="button" className="panel-link">Go to Delivery <ArrowRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}
