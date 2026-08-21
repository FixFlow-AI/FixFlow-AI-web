import { useState } from "react";
import { ArrowLeft, ShieldCheck, Github, Clock3 } from "lucide-react";
import { useLandingStore } from "../store/useLandingStore";
import { Brand } from "../components/Brand";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { GithubSignInButton } from "../components/GithubSignInButton";
import { audiences } from "../data/landing";
import { FREELANCER_ONLY_ONBOARDING } from "../config/launchMode";

const SIGNUP_ROLE_IDS = ["freelancer", "client", "developer", "agency"];

const ROLE_HELP = {
  client: "Post a structured brief and get an explainable, evidence-backed shortlist.",
  freelancer:
    "Connect GitHub and turn your real repositories into a verified, non-editable skills profile.",
  developer:
    "Plan and run software projects with generated timelines and a shared workspace.",
  agency: "Build a verified team roster with shared delivery and payment governance.",
};

export function Signup() {
  const { setPage, audience } = useLandingStore();
  const [selectedRole, setSelectedRole] = useState(
    audience && SIGNUP_ROLE_IDS.includes(audience)
      ? audience
      : (FREELANCER_ONLY_ONBOARDING ? "freelancer" : "client"),
  );

  const signupRoles = SIGNUP_ROLE_IDS
    .map((id) => audiences.find((a) => a.id === id))
    .filter(Boolean);
  const selectedRoleComingSoon =
    FREELANCER_ONLY_ONBOARDING && selectedRole !== "freelancer";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#f8fafc",
        padding: "48px 24px",
      }}
    >
      {/* Header */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        <a
          href="#/"
          onClick={() => setPage("landing")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            fontWeight: 600,
            color: "#64748b",
            textDecoration: "none",
          }}
        >
          <ArrowLeft size={15} /> Back to home
        </a>
        <Brand compact />
      </div>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 36,
          boxShadow: "0 4px 24px rgba(15,23,42,0.04)",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>
          {FREELANCER_ONLY_ONBOARDING
            ? "Build your verified freelancer profile"
            : "Create your workspace"}
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px", lineHeight: 1.6 }}>
          {FREELANCER_ONLY_ONBOARDING
            ? "Freelancer onboarding is now open. Connect GitHub to verify your skills from real code."
            : "Choose your role and start building trust-backed agreements."}
        </p>

        <form onSubmit={(e) => e.preventDefault()}>
          {/* Roles remain visible so the launch scope is clear. Non-freelancer
              cards are intentionally unavailable rather than silently removed. */}
          <div style={{ marginBottom: 22 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
              Choose how you want to join
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {signupRoles.map((aud) => {
                const Icon = aud.icon;
                const isComingSoon = FREELANCER_ONLY_ONBOARDING && aud.id !== "freelancer";
                const isActive = selectedRole === aud.id;
                return (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setSelectedRole(aud.id)}
                    aria-pressed={isActive}
                    style={{
                      minHeight: 88,
                      padding: "13px 14px",
                      border: isActive ? "1px solid #2563eb" : "1px solid #e2e8f0",
                      borderRadius: 12,
                      background: isActive
                        ? "linear-gradient(145deg, #eff6ff 0%, #eef2ff 100%)"
                        : isComingSoon ? "#f8fafc" : "#fff",
                      color: isActive ? "#1d4ed8" : "#475569",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 8,
                      textAlign: "left",
                      boxShadow: isActive ? "0 8px 24px rgba(37,99,235,0.10)" : "none",
                      transition: "all 160ms ease",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 750 }}>
                      <Icon size={16} /> {aud.title.replace(/s$/, "")}
                    </span>
                    {isComingSoon ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 7px", borderRadius: 999, background: "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c", fontSize: 9, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase" }}>
                        <Clock3 size={10} /> Coming Soon
                      </span>
                    ) : (
                      <span style={{ fontSize: 10, fontWeight: 800, color: "#047857", textTransform: "uppercase", letterSpacing: ".06em" }}>
                        Onboarding open
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "10px 0 0", lineHeight: 1.55 }}>
              {ROLE_HELP[selectedRole]}
            </p>
          </div>

          {selectedRoleComingSoon ? (
            <div style={{ padding: 16, borderRadius: 10, background: "linear-gradient(135deg, #fff7ed, #fffbeb)", border: "1px solid #fed7aa", color: "#9a3412" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 800 }}>
                <Clock3 size={16} /> {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)} onboarding is coming soon
              </div>
              <p style={{ margin: "6px 0 0", fontSize: 12, lineHeight: 1.55, color: "#b45309" }}>
                We are opening access in stages. Existing users can still sign in and use their current workspace.
              </p>
            </div>
          ) : selectedRole === "freelancer" ? (
            <>
              <GithubSignInButton
                intendedRole="freelancer"
                nextHash="#/dashboard/role-onboarding"
                label="Create verified profile with GitHub"
              />
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 12, color: "#64748b" }}>
                <Github size={13} /> Public repositories are analyzed to build evidence-backed skills.
              </div>
            </>
          ) : (
            <GoogleSignInButton
              nextHash="#/dashboard/role-onboarding"
              roleToSet={selectedRole}
            />
          )}
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 20,
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          <ShieldCheck size={14} />
          No credit card required
        </div>
      </div>

      {/* Login link */}
      <p style={{ marginTop: 24, fontSize: 13, color: "#64748b" }}>
        Already have an account?{" "}
        <a
          href="#/login"
          style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
        >
          Sign in
        </a>
      </p>
    </div>
  );
}
