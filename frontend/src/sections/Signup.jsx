import { useState } from "react";
import { ArrowLeft, ShieldCheck, Github } from "lucide-react";
import { useLandingStore } from "../store/useLandingStore";
import { Brand } from "../components/Brand";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { GithubSignInButton } from "../components/GithubSignInButton";
import { audiences } from "../data/landing";

// The three primary sign-up roles (agency stays available via role settings).
const SIGNUP_ROLE_IDS = ["client", "freelancer", "developer"];

const ROLE_HELP = {
  client: "Post a structured brief and get an explainable, evidence-backed shortlist.",
  freelancer:
    "Sign in with GitHub — we build your verified skill profile from your real code, so you get matched on proof, not profile polish.",
  developer:
    "Plan and run your own software projects: auto-generate timelines, proposals, and a team workspace.",
};

export function Signup() {
  const { setPage } = useLandingStore();
  const [selectedRole, setSelectedRole] = useState("client");

  const signupRoles = SIGNUP_ROLE_IDS
    .map((id) => audiences.find((a) => a.id === id))
    .filter(Boolean);

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
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>Create your workspace</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px" }}>
          Choose your role and start building trust-backed agreements.
        </p>

        <form onSubmit={(e) => e.preventDefault()}>
          {/* Role selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              I am a
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 0,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {signupRoles.map((aud) => {
                const Icon = aud.icon;
                return (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() => setSelectedRole(aud.id)}
                    style={{
                      padding: "10px 8px",
                      border: "none",
                      borderRight: "1px solid #e2e8f0",
                      background: selectedRole === aud.id ? "#2563eb" : "#fff",
                      color: selectedRole === aud.id ? "#fff" : "#475569",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      transition: "background 150ms ease, color 150ms ease",
                    }}
                  >
                    <Icon size={14} />
                    {aud.title.replace(/s$/, "")}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: 12, color: "#64748b", margin: "8px 0 0", lineHeight: 1.5 }}>
              {ROLE_HELP[selectedRole]}
            </p>
          </div>

          {/* Auth control depends on the chosen role.
              Freelancers must use GitHub (their profile is built from their code);
              clients and developers use Google. */}
          {selectedRole === "freelancer" ? (
            <>
              <GithubSignInButton
                intendedRole="freelancer"
                nextHash="#/dashboard/role-onboarding"
                label="Sign up with GitHub"
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginTop: 10,
                  fontSize: 12,
                  color: "#64748b",
                }}
              >
                <Github size={13} /> We analyze your public repositories to verify your skills.
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
