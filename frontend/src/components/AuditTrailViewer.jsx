import { useEffect, useState } from "react";
import { ShieldCheck, ShieldAlert, X, ArrowRight } from "lucide-react";
import { api, ApiError } from "../lib/api";

/**
 * AuditTrailViewer (STORY-10) — slide-out drawer that renders the SHA-256
 * audit chain for a milestone and shows whether the chain is intact. Fetches
 * from GET /api/escrow/milestones/:id/audit via api.getMilestoneAudit().
 *
 * Props:
 *   open, milestoneId, milestoneTitle, onClose()
 */
export function AuditTrailViewer({ open, milestoneId, milestoneTitle, onClose }) {
  const [blocks, setBlocks] = useState([]);
  const [valid, setValid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !milestoneId) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    api
      .getMilestoneAudit(milestoneId)
      .then((res) => {
        if (cancelled) return;
        setBlocks(res.blocks || []);
        setValid(res.valid);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Could not load audit trail.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, milestoneId]);

  if (!open) return null;

  const short = (h) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.5)", backdropFilter: "blur(4px)", zIndex: 200, display: "flex", justifyContent: "flex-end" }} onClick={onClose}>
      <div
        style={{ width: "min(520px, 100%)", height: "100%", background: "#fff", boxShadow: "-20px 0 40px rgba(0,0,0,0.1)", display: "flex", flexDirection: "column", color: "#0f172a" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 22px", borderBottom: "1px solid #e2e8f0" }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Cryptographic Audit Trail</h2>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0" }}>{milestoneTitle}</p>
          </div>
          <button type="button" onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {valid !== null && !loading && !error && (
          <div style={{ margin: "16px 22px 0", display: "inline-flex", alignItems: "center", gap: 8, alignSelf: "flex-start", padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, background: valid ? "#f0fdf4" : "#fef2f2", color: valid ? "#166534" : "#991b1b", border: `1px solid ${valid ? "#bbf7d0" : "#fee2e2"}` }}>
            {valid ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
            {valid ? "Audit Chain Valid" : "Audit Chain Tampered"}
          </div>
        )}

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 22px" }}>
          {loading && <p style={{ fontSize: 14, color: "#64748b" }}>Loading audit chain…</p>}
          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>
              {error}
            </div>
          )}
          {!loading && !error && blocks.length === 0 && (
            <p style={{ fontSize: 14, color: "#64748b" }}>No audit blocks recorded yet for this milestone.</p>
          )}

          {blocks.map((b) => (
            <div key={b.index} style={{ borderLeft: "2px solid #2563eb", paddingLeft: 14, marginBottom: 18, position: "relative" }}>
              <div style={{ position: "absolute", left: -6, top: 2, width: 10, height: 10, borderRadius: "50%", background: "#2563eb" }} />
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb" }}>#{b.index}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{b.fromState}</span>
                <ArrowRight size={12} style={{ color: "#94a3b8" }} />
                <span style={{ fontSize: 13, fontWeight: 700 }}>{b.toState}</span>
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                {new Date(b.timestamp).toLocaleString()} · {b.triggerUserRole}
              </div>
              {b.metadata && <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{b.metadata}</div>}
              <div style={{ fontSize: 10, color: "#cbd5e1", marginTop: 4, fontFamily: "monospace" }}>
                prev {short(b.previousHash)} → hash {short(b.hash)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
