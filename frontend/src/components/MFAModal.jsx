import { useState, useEffect, useRef } from "react";
import { ShieldCheck, X } from "lucide-react";

/**
 * MFAModal (STORY-11) — 6-digit OTP prompt shown before high-value escrow
 * transitions (Approve / Release Funds). Collects the token and hands it back
 * via onSubmit(token); the caller passes it as `mfaToken` to the backend.
 *
 * Props:
 *   open        — whether the modal is visible
 *   title       — heading text (e.g. "Approve Deliverables")
 *   description — sub text explaining the action being authorized
 *   loading     — disables inputs while the request is in flight
 *   error       — error string to display (e.g. "MFA verification failed")
 *   onSubmit(token)
 *   onClose()
 */
export function MFAModal({ open, title, description, loading, error, onSubmit, onClose }) {
  const [token, setToken] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setToken("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const canSubmit = /^\d{6}$/.test(token) && !loading;

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center", zIndex: 200, padding: 16 }}
      onClick={() => !loading && onClose?.()}
    >
      <div
        className="panel-card"
        style={{ maxWidth: 400, width: "100%", padding: 24, borderRadius: 12, background: "#fff", color: "#0f172a", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <ShieldCheck size={20} style={{ color: "#2563eb" }} /> {title || "Verify it's you"}
          </h2>
          <button type="button" onClick={() => !loading && onClose?.()} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
          {description || "Enter the 6-digit code from your authenticator app to authorize this action."}
        </p>

        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={token}
          disabled={loading}
          onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && canSubmit) onSubmit?.(token);
          }}
          placeholder="000000"
          style={{ width: "100%", padding: "12px 14px", fontSize: 22, letterSpacing: 8, textAlign: "center", border: "1.5px solid #e2e8f0", borderRadius: 8, fontWeight: 700, color: "#0f172a", boxSizing: "border-box" }}
        />

        {error && (
          <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
          <button type="button" className="panel-btn panel-btn--ghost" disabled={loading} onClick={() => onClose?.()}>
            Cancel
          </button>
          <button type="button" className="panel-btn" disabled={!canSubmit} onClick={() => onSubmit?.(token)}>
            {loading ? "Verifying..." : "Authorize"}
          </button>
        </div>
      </div>
    </div>
  );
}
