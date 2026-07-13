import { useEffect, useState } from "react";
import { ShieldCheck, Sparkles, Loader2 } from "lucide-react";

const STEPS = [
  "Connecting to GitHub secure gateway...",
  "Validating OAuth anti-forgery tokens...",
  "Exchanging authorization code for secure credentials...",
  "Verifying developer skills and commit footprint...",
  "Assembling trust-based workspace environment...",
  "Finalizing secure state-machine parameters...",
  "Launching FixFlowAI workspace..."
];

export function AuthLoader() {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIdx((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 280);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        // Sleek high-tech dark background with a deep radial blue-gray glow
        background: "radial-gradient(circle at center, #0d1527 0%, #030712 100%)",
        color: "#f8fafc",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Decorative subtle background grid or glows */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "400px",
          height: "400px",
          background: "radial-gradient(circle, rgba(37, 99, 235, 0.12) 0%, rgba(0, 0, 0, 0) 70%)",
          pointerEvents: "none",
          filter: "blur(40px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "20%",
          left: "40%",
          width: "300px",
          height: "300px",
          background: "radial-gradient(circle, rgba(109, 74, 255, 0.08) 0%, rgba(0, 0, 0, 0) 70%)",
          pointerEvents: "none",
          filter: "blur(30px)",
        }}
      />

      {/* Main Glassmorphic Container */}
      <div
        style={{
          width: "90%",
          maxWidth: "440px",
          padding: "40px 32px",
          background: "rgba(15, 23, 42, 0.45)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: "16px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)",
          textAlign: "center",
          position: "relative",
          zIndex: 10,
        }}
      >
        {/* Top brand header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "32px" }}>
          <ShieldCheck size={20} style={{ color: "#3b82f6" }} />
          <span style={{ fontWeight: 800, fontSize: "14px", letterSpacing: "1.5px", textTransform: "uppercase", color: "#94a3b8" }}>
            FixFlow<span style={{ color: "#3b82f6" }}>AI</span> SECURE
          </span>
        </div>

        {/* Animated Double-Ring Spinner */}
        <div style={{ position: "relative", width: "90px", height: "90px", margin: "0 auto 36px", display: "flex", alignItems: "center", justifyItems: "center" }}>
          {/* Outer Ring */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "50%",
              border: "3px solid transparent",
              borderTopColor: "#2563eb",
              borderBottomColor: "#2563eb",
              animation: "spin 1.5s linear infinite",
            }}
          />
          {/* Inner Ring (opposite direction) */}
          <div
            style={{
              position: "absolute",
              inset: "8px",
              borderRadius: "50%",
              border: "3px solid transparent",
              borderLeftColor: "#6d4aff",
              borderRightColor: "#6d4aff",
              animation: "spin-reverse 1.2s linear infinite",
            }}
          />
          {/* Centered Pulse core */}
          <div
            style={{
              position: "absolute",
              inset: "22px",
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(37, 99, 235, 0.3) 0%, rgba(109, 74, 255, 0.1) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              animation: "pulse 1.8s ease-in-out infinite",
            }}
          >
            <Sparkles size={16} style={{ color: "#60a5fa" }} />
          </div>
        </div>

        {/* Main Status Heading */}
        <h2 style={{ fontSize: "20px", fontWeight: 700, margin: "0 0 10px", color: "#f8fafc", letterSpacing: "-0.01em" }}>
          Securing Connection
        </h2>

        {/* Step log ticker */}
        <div style={{ height: "48px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p
            key={stepIdx} // Trigger keyframe animation on change
            style={{
              fontSize: "13px",
              color: "#94a3b8",
              lineHeight: "1.5",
              margin: 0,
              animation: "fadeInUp 0.3s ease-out forwards",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Loader2 size={13} className="animate-spin" style={{ color: "#3b82f6", flexShrink: 0 }} />
            {STEPS[stepIdx]}
          </p>
        </div>

        {/* Progress Dots */}
        <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginTop: "24px" }}>
          {STEPS.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: idx <= stepIdx ? "#2563eb" : "rgba(255, 255, 255, 0.1)",
                boxShadow: idx === stepIdx ? "0 0 8px #2563eb" : "none",
                transition: "background 0.2s ease, box-shadow 0.2s ease",
              }}
            />
          ))}
        </div>
      </div>

      {/* Inject custom CSS keyframes for rotation animations */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes spin-reverse {
          to { transform: rotate(-360deg); }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.1); opacity: 0.65; }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
