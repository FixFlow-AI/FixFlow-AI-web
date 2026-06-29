import { useState } from "react";
import { useLandingStore } from "../../store/useLandingStore";
import {
  Building2,
  Users,
  FolderGit2,
  FileText,
  Wallet,
  Check,
  ArrowRight,
  Bookmark,
  Code2,
  UserRound,
  BriefcaseBusiness,
  Plus,
  AlertCircle,
  MoreHorizontal,
  BadgeCheck,
  ExternalLink,
} from "lucide-react";

const roles = [
  { id: "client", label: "Client", icon: UserRound },
  { id: "freelancer", label: "Freelancer", icon: UserRound },
  { id: "agency", label: "Agency", icon: Users },
  { id: "developer", label: "Developer", icon: Code2 },
];

const onboardingSteps = [
  { num: 1, label: "Organization", done: true },
  { num: 2, label: "Team and roles", done: true },
  { num: 3, label: "Work evidence", active: true },
  { num: 4, label: "Proposal defaults" },
  { num: 5, label: "Payment preferences" },
];

const proofItems = [];

const teamMembers = [];

const whyMatters = [
  {
    icon: Users,
    title: "Team evidence can support future recommendations.",
    desc: "We match based on relevant proof, not just profiles.",
  },
  {
    icon: FileText,
    title: "Proposal roles stay connected to verified work.",
    desc: "Roles, expertise, and proof travel together.",
  },
  {
    icon: BadgeCheck,
    title: "Clients can inspect ownership before approval.",
    desc: "Clarity builds confidence before work begins.",
  },
];

export function RoleOnboarding() {
  const { userRole, onboardingTeam, addOnboardingTeam } = useLandingStore();
  const [selectedRole, setSelectedRole] = useState(userRole || "agency");
  const [inviteEmail, setInviteEmail] = useState("");

  const handleInvite = (e) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      addOnboardingTeam(inviteEmail.trim());
      setInviteEmail("");
    }
  };

  return (
    <div>
      {/* Page header */}
      <div className="panel-page-header">
        <h1 className="panel-page-title">Set up your FixFlowAI workspace</h1>
        <p className="panel-page-subtitle">
          Your role changes the evidence and workflow we ask for.
        </p>
      </div>

      {/* Role selector tabs */}
      <div
        style={{
          display: "flex",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          overflow: "hidden",
          marginBottom: 28,
        }}
      >
        {roles.map((role) => {
          const Icon = role.icon;
          const isActive = selectedRole === role.id;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => setSelectedRole(role.id)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "12px 16px",
                border: "none",
                background: isActive ? "#2563eb" : "#fff",
                color: isActive ? "#fff" : "#475569",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                transition: "background 150ms ease, color 150ms ease",
              }}
            >
              <Icon size={16} />
              {role.label}
            </button>
          );
        })}
      </div>

      {/* Three-column grid */}
      <div className="panel-grid panel-grid--3">
        {/* Left: Onboarding steps */}
        <div className="panel-card">
          {onboardingSteps.map((step) => (
            <div
              key={step.num}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: step.active ? "14px 20px" : "14px 0",
                borderBottom: "1px solid #f1f5f9",
                background: step.active ? "#eff6ff" : "transparent",
                margin: step.active ? "0 -20px" : 0,
                borderRadius: 0,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  background: step.done
                    ? "#16a34a"
                    : step.active
                    ? "#2563eb"
                    : "#f8fafc",
                  color: step.done || step.active ? "#fff" : "#94a3b8",
                  border:
                    !step.done && !step.active ? "1.5px solid #e2e8f0" : "none",
                  flexShrink: 0,
                }}
              >
                {step.done ? <Check size={13} strokeWidth={3} /> : step.num}
              </span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: step.active ? 700 : 500,
                  color: step.done || step.active ? "#0f172a" : "#94a3b8",
                }}
              >
                {step.label}
              </span>
              {step.done && (
                <span className="panel-badge panel-badge--green" style={{ marginLeft: "auto" }}>
                  Complete
                </span>
              )}
              {step.active && (
                <span className="panel-badge panel-badge--blue" style={{ marginLeft: "auto" }}>
                  Current
                </span>
              )}
              {!step.done && !step.active && (
                <span className="panel-badge panel-badge--gray" style={{ marginLeft: "auto" }}>
                  {step.num === 4 ? "Next" : "Later"}
                </span>
              )}
            </div>
          ))}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 0 0",
              fontSize: 13,
              color: "#64748b",
            }}
          >
            <span style={{ color: "#a78bfa" }}>✦</span>
            We personalize what we ask based on your role and goals.
          </div>
        </div>

        {/* Center: Main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Connect team proof */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Connect team proof</h2>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
              Add verifiable work and outcomes that represent your team.
            </p>

            {proofItems.length > 0 ? (
              proofItems.map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "14px 16px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: "#f8fafc",
                      display: "grid",
                      placeItems: "center",
                      color: "#475569",
                      flexShrink: 0,
                      border: "1px solid #e2e8f0",
                    }}
                  >
                    <FolderGit2 size={16} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.desc}</div>
                  </div>
                  <span
                    className={`panel-badge panel-badge--${item.badgeColor}`}
                    style={{ flexShrink: 0 }}
                  >
                    {item.badgeColor === "green" && <Check size={11} />}
                    {item.badgeColor === "orange" && <AlertCircle size={11} />}
                    {item.badge}
                  </span>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, color: "#64748b", padding: "10px 0" }}>
                No team proof connected yet. Connect repositories once onboarding is completed.
              </p>
            )}

            <button
              type="button"
              className="panel-link"
              style={{ marginTop: 8 }}
            >
              <Plus size={14} /> Add more proof
            </button>
          </div>

          {/* Team roles table */}
          <div className="panel-card" style={{ padding: 0 }}>
            <div className="panel-card-header" style={{ padding: "16px 20px" }}>
              <h2 className="panel-card-title">Team roles and assignments</h2>
            </div>

            {/* Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1fr 1.2fr 1fr auto",
                gap: 8,
                padding: "8px 20px",
                borderBottom: "1px solid #e2e8f0",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#94a3b8",
              }}
            >
              <span>Team member</span>
              <span>Role</span>
              <span>Primary expertise</span>
              <span>Proof linked</span>
              <span />
            </div>

            {onboardingTeam.length > 0 ? (
              onboardingTeam.map((email) => (
                <div
                  key={email}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1.2fr 1.2fr auto",
                    gap: 8,
                    padding: "12px 20px",
                    borderBottom: "1px solid #f1f5f9",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "#e2e8f0",
                        display: "grid",
                        placeItems: "center",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#475569",
                      }}
                    >
                      {email[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", wordBreak: "break-all" }}>
                      {email}
                    </span>
                  </div>
                  <span className="panel-badge panel-badge--blue">Member</span>
                  <span style={{ fontSize: 13, color: "#475569" }}>Invited</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#94a3b8" }}>
                    Pending Setup
                  </span>
                  <button
                    type="button"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#94a3b8",
                      cursor: "pointer",
                      padding: 4,
                    }}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 13, color: "#64748b", padding: "20px", textAlign: "center" }}>
                No team members invited yet. Use the form below to add them.
              </p>
            )}

            <div style={{ padding: "16px 20px" }}>
              <form onSubmit={handleInvite} style={{ display: "flex", gap: 8 }}>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborator@company.com"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
                <button type="submit" className="panel-btn" style={{ minHeight: 0, padding: "8px 12px" }}>
                  <Plus size={14} /> Invite
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right: Why this matters */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Why this matters</h2>
            <BadgeCheck size={20} style={{ color: "#2563eb" }} />
          </div>

          {whyMatters.map((item) => {
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
                    background: "#eff6ff",
                    display: "grid",
                    placeItems: "center",
                    color: "#2563eb",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={15} />
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

          <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>
            Workspace preview
          </h3>
          <p style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, margin: "0 0 8px" }}>
            Your setup influences what clients see in proposals and agreements.
          </p>
          <button type="button" className="panel-link">
            Preview as client <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left" />
        <div className="panel-action-bar-right">
          <button type="button" className="panel-btn--ghost panel-btn">
            <Bookmark size={14} /> Save and return later
          </button>
          <button type="button" className="panel-btn">
            Continue to proposal defaults <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
