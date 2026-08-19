import { useEffect, useState } from "react";
import { ArrowLeft, ShieldCheck, Terminal } from "lucide-react";
import { useLandingStore } from "../store/useLandingStore";
import { Brand } from "../components/Brand";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { GithubSignInButton } from "../components/GithubSignInButton";
import { api } from "../lib/api";
import { setSession } from "../lib/auth";

const SHOW_DEV_LOGIN = import.meta.env.DEV;

export function Login() {
  const { setPage, login } = useLandingStore();
  const [devEmail, setDevEmail] = useState("developer@company.com");
  const [devName, setDevName] = useState("Jane Developer");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Surface any GitHub OAuth error passed back from the redirect handler.
  useEffect(() => {
    const ghError = window.sessionStorage.getItem("ff_github_error");
    if (ghError) {
      setError(ghError);
      window.sessionStorage.removeItem("ff_github_error");
    }
  }, []);

  const handleDevLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { user, accessToken, refreshToken } = await api.devLogin(devEmail, devName);
      setSession({ user, accessToken, refreshToken });
      login(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dev login failed");
    } finally {
      setLoading(false);
    }
  };

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
          maxWidth: 420,
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
          maxWidth: 420,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 36,
          boxShadow: "0 4px 24px rgba(15,23,42,0.04)",
        }}
      >
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 4px" }}>Welcome back</h1>
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 18px", lineHeight: 1.55 }}>
          Existing clients, agencies, developers, and freelancers can continue with their original sign-in method.
        </p>

        {error && (
          <div style={{ fontSize: 13, color: "#b91c1c", background: "#fef2f2", padding: 10, borderRadius: 8, border: "1px solid #fecaca", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <GoogleSignInButton nextHash="#/dashboard/overview" />

        <div style={{ margin: "16px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>OR</span>
          <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
        </div>

        {/* Freelancers sign in with GitHub. */}
        <GithubSignInButton
          intendedRole="freelancer"
          nextHash="#/dashboard/overview"
          label="Sign in with GitHub"
        />

        {SHOW_DEV_LOGIN && (
          <>
            <div style={{ margin: "24px 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
              <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>LOCAL DEVELOPMENT</span>
              <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
            </div>

            <form onSubmit={handleDevLogin} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="email"
                value={devEmail}
                onChange={(e) => setDevEmail(e.target.value)}
                placeholder="Email (e.g. developer@company.com)"
                required
                style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }}
              />
              <input
                type="text"
                value={devName}
                onChange={(e) => setDevName(e.target.value)}
                placeholder="Name (e.g. Jane Developer)"
                required
                style={{ padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13 }}
              />
              <button
                type="submit"
                disabled={loading}
                className="panel-btn"
                style={{ width: "100%", background: "#0f172a", color: "#fff", display: "flex", justifyContent: "center", gap: 8 }}
              >
                <Terminal size={14} /> {loading ? "Signing in..." : "Developer Login"}
              </button>
            </form>
          </>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            marginTop: 24,
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          <ShieldCheck size={14} />
          Protected by FixFlowAI security
        </div>
      </div>

      {/* Sign up link */}
      <p style={{ marginTop: 24, fontSize: 13, color: "#64748b" }}>
        Don't have an account?{" "}
        <a
          href="#/signup"
          style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
        >
          Request access
        </a>
      </p>
    </div>
  );
}
