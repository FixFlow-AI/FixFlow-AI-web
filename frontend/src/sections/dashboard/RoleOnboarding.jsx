import { useState } from "react";
import { useLandingStore } from "../../store/useLandingStore";
import { FreelancerScanOnboarding } from "./FreelancerScanOnboarding";
import { GithubSignInButton } from "../../components/GithubSignInButton";
import { api } from "../../lib/api";
import { setSession } from "../../lib/auth";
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
  Trash2,
} from "lucide-react";

const roles = [
  { id: "client", label: "Client", icon: UserRound },
  { id: "developer", label: "Developer", icon: Code2 },
  { id: "agency", label: "Agency", icon: Users },
  { id: "freelancer", label: "Freelancer", icon: UserRound },
];

const stepsByRole = {
  client: [
    { num: 1, label: "Organization Details", done: true },
    { num: 2, label: "Project Preferences", done: true },
    { num: 3, label: "Escrow Preferences", active: true },
    { num: 4, label: "Invite Co-workers" },
    { num: 5, label: "Billing Setup" },
  ],
  developer: [
    { num: 1, label: "Profile Verification", done: true },
    { num: 2, label: "Workspace Identity", done: true },
    { num: 3, label: "Repository Proof", active: true },
    { num: 4, label: "Teammates roster" },
    { num: 5, label: "Notifications setup" },
  ],
  agency: [
    { num: 1, label: "Agency Identity", done: true },
    { num: 2, label: "Roster Setup", done: true },
    { num: 3, label: "Connect Repositories", active: true },
    { num: 4, label: "Commission Defaults" },
    { num: 5, label: "Multi-sig Setup" },
  ],
  freelancer: [
    { num: 1, label: "GitHub Connection", active: true },
    { num: 2, label: "Code Analysis" },
    { num: 3, label: "Verified Skills" },
    { num: 4, label: "Top Projects" },
    { num: 5, label: "Profile Confidence" },
  ],
};

const whyMattersByRole = {
  client: [
    {
      icon: BadgeCheck,
      title: "Clear briefs, better shortlists.",
      desc: "Detailed requirements help our engine find verified matches.",
    },
    {
      icon: Wallet,
      title: "Secure Milestone Escrow",
      desc: "Funds are locked in transparent smart-contracts and released on evidence.",
    },
    {
      icon: Users,
      title: "Zero-Noise Collaboration",
      desc: "Keep your legal, product, and tech teams aligned on one platform.",
    },
  ],
  developer: [
    {
      icon: Code2,
      title: "Auto-Generated Timelines",
      desc: "Our AI constructs a complete task backlog and weeks-based roadmap instantly.",
    },
    {
      icon: FolderGit2,
      title: "Verifiable Code Evidence",
      desc: "Connect your team's repos to easily prove capabilities to clients.",
    },
    {
      icon: Users,
      title: "Real-Time Team Sync",
      desc: "Teammates collaborate on task boards with optimistic WS syncing.",
    },
  ],
  agency: [
    {
      icon: Users,
      title: "Unified Roster Evidence",
      desc: "Combine work evidence from all your developers to win premium contracts.",
    },
    {
      icon: BadgeCheck,
      title: "Agency-Level Trust Scores",
      desc: "Build a shared agency reputation based on completed milestones.",
    },
    {
      icon: Wallet,
      title: "Escrow Allocations",
      desc: "Auto-distribute milestone releases to team members securely.",
    },
  ],
  freelancer: [
    {
      icon: Code2,
      title: "GitHub Identity Vetting",
      desc: "No resume writing. Your real commits prove your skills automatically.",
    },
    {
      icon: BadgeCheck,
      title: "Tamper-Proof Skills",
      desc: "Clients search for developers with verified proof, bypassing resume noise.",
    },
    {
      icon: Wallet,
      title: "Guaranteed Escrow Payments",
      desc: "Milestone payments are pre-funded. Complete the task, get paid automatically.",
    },
  ],
};

export function RoleOnboarding() {
  const { userRole, onboardingTeam, addTeamMember, removeTeamMember, login } = useLandingStore();
  const [selectedRole, setSelectedRole] = useState(userRole || "client");
  const [inviteEmail, setInviteEmail] = useState("");
  
  // Form states
  const [orgName, setOrgName] = useState("");
  const [industry, setIndustry] = useState("tech");
  const [projectCategory, setProjectCategory] = useState("software");
  const [focusArea, setFocusArea] = useState("fullstack");
  const [portfolio, setPortfolio] = useState("");
  const [proofItems, setProofItems] = useState([
    { name: "main-platform-api", desc: "Express / Node API repository", badge: "Verified", badgeColor: "green" },
    { name: "frontend-dashboard", desc: "React + Vite UI application", badge: "Pending", badgeColor: "orange" }
  ]);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Freelancers get the live GitHub-scan onboarding (roles/01) instead of the
  // generic team/proof setup.
  if (userRole === "freelancer") {
    return <FreelancerScanOnboarding />;
  }

  const handleInvite = (e) => {
    e.preventDefault();
    if (inviteEmail.trim()) {
      addTeamMember(inviteEmail.trim());
      setInviteEmail("");
    }
  };

  const handleAddProof = () => {
    const name = prompt("Enter repository name (e.g. billing-service):");
    if (!name) return;
    const desc = prompt("Enter repository description (optional):");
    setProofItems([
      ...proofItems,
      {
        name: name.trim(),
        desc: desc ? desc.trim() : "Repository connected as proof",
        badge: "Verifying",
        badgeColor: "blue",
      }
    ]);
  };

  const handleSave = async (complete = false) => {
    if (selectedRole === "freelancer") {
      setError("Please connect your GitHub account using the button above to onboard as a Freelancer.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // 1. Call backend PATCH /api/auth/me/role
      const { user: updated } = await api.setRole(selectedRole);
      // 2. Update local session & state
      setSession({ user: updated });
      login(updated);
      
      // 3. Route to workspace
      window.location.hash = "#/dashboard/overview";
    } catch (err) {
      console.error("[RoleOnboarding] failed to save role:", err);
      setError(err instanceof Error ? err.message : "Failed to save role settings. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const activeSteps = stepsByRole[selectedRole] || stepsByRole.client;
  const activeWhyMatters = whyMattersByRole[selectedRole] || whyMattersByRole.client;

  const renderTeamRosterCard = () => {
    return (
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
          <span>Status</span>
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
                onClick={() => removeTeamMember(email)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4,
                  display: "grid",
                  placeItems: "center"
                }}
                title="Remove invitation"
              >
                <Trash2 size={14} />
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
    );
  };

  const renderProofItemsCard = () => {
    return (
      <div className="panel-card">
        <div className="panel-card-header">
          <h2 className="panel-card-title">Connect team proof</h2>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
          Add verifiable work and outcomes that represent your team.
        </p>

        {proofItems.length > 0 ? (
          proofItems.map((item, idx) => (
            <div
              key={item.name + idx}
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
              <button
                type="button"
                onClick={() => setProofItems(proofItems.filter((_, i) => i !== idx))}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4,
                  display: "grid",
                  placeItems: "center"
                }}
                title="Remove proof"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        ) : (
          <p style={{ fontSize: 13, color: "#64748b", padding: "10px 0" }}>
            No team proof connected yet. Connect repositories once onboarding is completed.
          </p>
        )}

        <button
          type="button"
          onClick={handleAddProof}
          className="panel-link"
          style={{ marginTop: 8 }}
        >
          <Plus size={14} /> Add more proof
        </button>
      </div>
    );
  };

  const renderCenterPanel = () => {
    if (selectedRole === "freelancer") {
      return (
        <div className="panel-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel-card-header">
            <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Code2 size={18} /> Connect your GitHub Account
            </h2>
          </div>
          <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
            To onboard as a Freelancer, we require verifying your skills directly from your code. We will run a deep, parallel scan of your public repository history to build a verified skill profile.
          </p>
          <div style={{ padding: "12px 0" }}>
            <GithubSignInButton intendedRole="freelancer" label="Connect GitHub Profile" />
          </div>
        </div>
      );
    }

    if (selectedRole === "client") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Organization Details */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Client Profile Settings</h2>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
              Configure your workspace organization and default preferences.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Corporation"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Industry Vertical
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      fontSize: 13,
                      background: "#fff",
                    }}
                  >
                    <option value="tech">Technology / SaaS</option>
                    <option value="finance">Finance / Fintech</option>
                    <option value="healthcare">Healthcare</option>
                    <option value="ecom">E-Commerce</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                    Project Category
                  </label>
                  <select
                    value={projectCategory}
                    onChange={(e) => setProjectCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      fontSize: 13,
                      background: "#fff",
                    }}
                  >
                    <option value="software">Web & Mobile Apps</option>
                    <option value="aiml">AI / Machine Learning</option>
                    <option value="design">UI/UX Design</option>
                    <option value="marketing">Marketing & Content</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Invite form */}
          {renderTeamRosterCard()}
        </div>
      );
    }

    if (selectedRole === "developer") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Workspace identity */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Developer Workspace Defaults</h2>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
              Define default settings for your workspace and technical focuses.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                  Team / Developer Namespace
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Acme Devs"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                  Primary Focus Area
                </label>
                <select
                  value={focusArea}
                  onChange={(e) => setFocusArea(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 13,
                    background: "#fff",
                  }}
                >
                  <option value="frontend">Frontend Engineering</option>
                  <option value="backend">Backend Engineering</option>
                  <option value="fullstack">Full-Stack Development</option>
                  <option value="blockchain">Smart Contract / Web3</option>
                </select>
              </div>
            </div>
          </div>

          {/* Connect repo proof */}
          {renderProofItemsCard()}

          {/* Team roles table */}
          {renderTeamRosterCard()}
        </div>
      );
    }

    if (selectedRole === "agency") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Agency Settings */}
          <div className="panel-card">
            <div className="panel-card-header">
              <h2 className="panel-card-title">Agency Credentials</h2>
            </div>
            <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
              Onboard your software agency to coordinate team deliverables.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                  Agency Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. DevCorp Labs"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 4 }}>
                  Agency Portfolio URL
                </label>
                <input
                  type="text"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  placeholder="e.g. https://devcorp-labs.com"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 6,
                    fontSize: 13,
                  }}
                />
              </div>
            </div>
          </div>

          {/* Connect repo proof */}
          {renderProofItemsCard()}

          {/* Team roles table */}
          {renderTeamRosterCard()}
        </div>
      );
    }
  };

  const handlePreviewAlert = () => {
    alert("Workspace preview loaded! This shows a mocked presentation of your profile and agreements as viewed by a client.");
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

      {error && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#fef2f2", border: "1px solid #fee2e2", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

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
          {activeSteps.map((step) => (
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
        <div>
          {renderCenterPanel()}
        </div>

        {/* Right: Why this matters */}
        <div className="panel-card">
          <div className="panel-card-header">
            <h2 className="panel-card-title">Why this matters</h2>
            <BadgeCheck size={20} style={{ color: "#2563eb" }} />
          </div>

          {activeWhyMatters.map((item) => {
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
          <button type="button" onClick={handlePreviewAlert} className="panel-link">
            Preview as client <ExternalLink size={13} />
          </button>
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="panel-action-bar">
        <div className="panel-action-bar-left" />
        <div className="panel-action-bar-right">
          <button 
            type="button" 
            className="panel-btn--ghost panel-btn"
            onClick={() => handleSave(false)}
            disabled={busy || selectedRole === "freelancer"}
            style={{ opacity: selectedRole === "freelancer" ? 0.5 : 1 }}
          >
            <Bookmark size={14} /> Save and return later
          </button>
          <button 
            type="button" 
            className="panel-btn"
            onClick={() => handleSave(true)}
            disabled={busy || selectedRole === "freelancer"}
            style={{ opacity: selectedRole === "freelancer" ? 0.5 : 1 }}
          >
            {selectedRole === "client" ? "Continue to Brief & Planning" : "Complete Onboarding"} <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
