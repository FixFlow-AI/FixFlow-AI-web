import { useState } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck, Mail, Lock, UserRound } from "lucide-react";
import { useLandingStore } from "../store/useLandingStore";
import { Brand } from "../components/Brand";
import { audiences } from "../data/landing";

export function Signup() {
  const { login, setPage } = useLandingStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState("client");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email) { setError("Email is required."); return; }
    if (!email.includes("@")) { setError("Please enter a valid work email."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      login(email, selectedRole);
      window.location.hash = "#/dashboard/role-onboarding";
    }, 850);
  };

  const activeAudience = audiences.find((a) => a.id === selectedRole);

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

        <form onSubmit={handleSubmit}>
          {error && (
            <div
              style={{
                padding: "10px 14px",
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: 8,
                fontSize: 13,
                color: "#c2410c",
                marginBottom: 20,
              }}
            >
              {error}
            </div>
          )}

          {/* Role selector */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              I am a
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 0,
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {audiences.map((aud) => {
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
            {activeAudience && (
              <p style={{ fontSize: 12, color: "#64748b", margin: "8px 0 0", lineHeight: 1.5 }}>
                {activeAudience.problems[0]}
              </p>
            )}
          </div>

          {/* Email */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Work email
            </label>
            <div style={{ position: "relative" }}>
              <Mail
                size={16}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 38px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <Lock
                size={16}
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "#94a3b8",
                }}
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Choose a password (6+ characters)"
                autoComplete="new-password"
                style={{
                  width: "100%",
                  padding: "10px 14px 10px 38px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: 14,
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="button"
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading ? "Creating workspace..." : (
              <>Create workspace <ArrowRight size={16} /></>
            )}
          </button>
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
