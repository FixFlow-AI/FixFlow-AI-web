import { useState, useEffect } from "react";
import { AlertTriangle, X, Plus, Trash2 } from "lucide-react";

/**
 * DisputeModal (STORY-09) — lets a client or freelancer file a dispute against
 * an active milestone, with a reason and a dynamic list of evidence URLs.
 * Calls onSubmit({ reason, evidenceUrls }); the caller invokes
 * api.disputeMilestone().
 *
 * Props:
 *   open, milestoneTitle, loading, error, onSubmit({reason, evidenceUrls}), onClose()
 */
export function DisputeModal({ open, milestoneTitle, loading, error, onSubmit, onClose }) {
  const [reason, setReason] = useState("");
  const [urls, setUrls] = useState([""]);

  useEffect(() => {
    if (open) {
      setReason("");
      setUrls([""]);
    }
  }, [open]);

  if (!open) return null;

  const setUrlAt = (i, value) => setUrls((prev) => prev.map((u, idx) => (idx === i ? value : u)));
  const addUrl = () => setUrls((prev) => [...prev, ""]);
  const removeUrl = (i) => setUrls((prev) => prev.filter((_, idx) => idx !== i));

  const canSubmit = reason.trim().length > 0 && !loading;

  const handleSubmit = () => {
    const evidenceUrls = urls.map((u) => u.trim()).filter(Boolean);
    onSubmit?.({ reason: reason.trim(), evidenceUrls });
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(8px)", display: "grid", placeItems: "center", zIndex: 200, padding: 16 }}
      onClick={() => !loading && onClose?.()}
    >
      <div
        className="panel-card"
        style={{ maxWidth: 460, width: "100%", padding: 24, borderRadius: 12, background: "#fff", color: "#0f172a", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, margin: 0 }}>
            <AlertTriangle size={20} style={{ color: "#ea580c" }} /> Raise a Dispute
          </h2>
          <button type="button" onClick={() => !loading && onClose?.()} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4 }} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 16px" }}>
          Escalate <strong>{milestoneTitle}</strong> for arbitration. Funds stay locked in escrow until resolved.
        </p>

        <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>
          Reason for dispute
        </label>
        <textarea
          value={reason}
          disabled={loading}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Describe the issue with the deliverable or agreement..."
          style={{ width: "100%", padding: "10px 12px", fontSize: 14, border: "1.5px solid #e2e8f0", borderRadius: 8, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
        />

        <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", display: "block", margin: "14px 0 6px" }}>
          Evidence links (optional)
        </label>
        {urls.map((u, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input
              type="url"
              value={u}
              disabled={loading}
              onChange={(e) => setUrlAt(i, e.target.value)}
              placeholder="https://..."
              style={{ flex: 1, padding: "8px 12px", fontSize: 13, border: "1.5px solid #e2e8f0", borderRadius: 8, boxSizing: "border-box" }}
            />
            {urls.length > 1 && (
              <button type="button" disabled={loading} onClick={() => removeUrl(i)} style={{ background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 8, padding: "0 10px", cursor: "pointer", color: "#991b1b" }} aria-label="Remove link">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <button type="button" disabled={loading} onClick={addUrl} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#2563eb", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}>
          <Plus size={14} /> Add another link
        </button>

        {error && (
          <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 20 }}>
          <button type="button" className="panel-btn panel-btn--ghost" disabled={loading} onClick={() => onClose?.()}>
            Cancel
          </button>
          <button type="button" className="panel-btn" disabled={!canSubmit} onClick={handleSubmit}>
            {loading ? "Filing..." : "File Dispute"}
          </button>
        </div>
      </div>
    </div>
  );
}
