import { useEffect, useState } from "react";
import { Bot, Slack, Github, Mail, ExternalLink, RefreshCw, ShieldCheck, Clock, AlertTriangle } from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";
import { api, ApiError } from "../../lib/api";

/**
 * Automations (Corsair track) — shows FixBot's cross-app actions and their
 * permission status. Reads flow; gated writes surface a Corsair approval link.
 */
const PLUGINS = [
  { id: "slack", label: "Slack", icon: Slack, desc: "Post project updates to a channel" },
  { id: "github", label: "GitHub", icon: Github, desc: "Attach PR/issue evidence to milestones" },
  { id: "gmail", label: "Gmail", icon: Mail, desc: "Email counterparties (approval-gated)" },
];

const STATUS_STYLE = {
  sent: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", label: "Sent" },
  pending_approval: { bg: "#fffbeb", border: "#fde68a", color: "#b45309", label: "Awaiting approval" },
  simulated: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", label: "Simulated" },
  failed: { bg: "#fef2f2", border: "#fee2e2", color: "#991b1b", label: "Failed" },
};

export function Automations() {
  const { parsedProposalId } = useLandingStore();
  const [configured, setConfigured] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connecting, setConnecting] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    api
      .listAutomations(parsedProposalId)
      .then((res) => {
        setConfigured(Boolean(res.configured));
        setRows(res.automations || []);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load automations."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [parsedProposalId]);

  const connect = async (plugin) => {
    setConnecting(plugin);
    setError("");
    try {
      const res = await api.corsairConnect(plugin, parsedProposalId);
      if (res.connectUrl) {
        window.open(res.connectUrl, "_blank", "noopener");
      } else if (res.error) {
        setError(res.error);
      } else if (res.simulated) {
        setError("Corsair isn't configured on the server yet — connect links are simulated. Set CORSAIR_* env vars to enable.");
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create connect link.");
    } finally {
      setConnecting("");
    }
  };

  return (
    <div>
      <div className="panel-page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="panel-page-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bot size={22} style={{ color: "#2563eb" }} /> Agent automations
            </h1>
            <p className="panel-page-subtitle">
              FixBot acts across your tools via Corsair — reads flow, writes ask first.
            </p>
          </div>
          <button type="button" className="panel-btn panel-btn--ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Corsair status banner */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10, marginBottom: 20, padding: "10px 14px", borderRadius: 8, fontSize: 13,
          background: configured ? "#f0fdf4" : "#eff6ff",
          border: `1px solid ${configured ? "#bbf7d0" : "#bfdbfe"}`,
          color: configured ? "#166534" : "#1e40af",
        }}
      >
        <ShieldCheck size={16} />
        {configured
          ? "Corsair is connected. Agent writes are permission-gated with human approval."
          : "Corsair runs in simulated mode (log-only). Configure CORSAIR_* on the server to go live."}
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: 8, fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Connect integrations */}
      <div className="panel-grid panel-grid--3" style={{ marginBottom: 20 }}>
        {PLUGINS.map((p) => {
          const Icon = p.icon;
          return (
            <div className="panel-card" key={p.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <Icon size={20} style={{ color: "#0f172a" }} />
                <span style={{ fontSize: 15, fontWeight: 700 }}>{p.label}</span>
              </div>
              <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 12px" }}>{p.desc}</p>
              <button
                type="button"
                className="panel-btn"
                style={{ fontSize: 13 }}
                disabled={connecting === p.id}
                onClick={() => connect(p.id)}
              >
                {connecting === p.id ? "Opening…" : `Connect ${p.label}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Action log */}
      <div className="panel-card" style={{ padding: 0 }}>
        <div className="panel-card-header" style={{ padding: "14px 20px" }}>
          <h2 className="panel-card-title">Recent agent actions</h2>
        </div>
        {loading ? (
          <p style={{ fontSize: 14, color: "#64748b", padding: 24, textAlign: "center" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 14, color: "#64748b", padding: 24, textAlign: "center" }}>
            No agent actions yet. Fund or release a milestone to see FixBot post an update.
          </p>
        ) : (
          rows.map((r) => {
            const s = STATUS_STYLE[r.status] || STATUS_STYLE.simulated;
            return (
              <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px", borderTop: "1px solid #f1f5f9" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{r.summary}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", fontFamily: "monospace" }}>
                    {r.action}{r.detail ? ` · ${r.detail}` : ""} · {new Date(r.createdAt).toLocaleTimeString()}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {r.approvalUrl && (
                    <a href={r.approvalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "#b45309", display: "inline-flex", alignItems: "center", gap: 4 }}>
                      Review <ExternalLink size={12} />
                    </a>
                  )}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                    {r.status === "pending_approval" ? <Clock size={11} /> : r.status === "failed" ? <AlertTriangle size={11} /> : <ShieldCheck size={11} />}
                    {s.label}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
