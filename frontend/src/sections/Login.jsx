import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useLandingStore } from "../store/useLandingStore";
import { Brand } from "../components/Brand";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

export function Login() {
  const { setPage } = useLandingStore();

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
        <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px" }}>
          Sign in with Google to open your project workspace.
        </p>

        <GoogleSignInButton nextHash="#/dashboard/overview" />

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
