import { useEffect, useState } from "react";
import { Wallet, Shield, ArrowDownCircle, FileText, RefreshCw } from "lucide-react";
import { api, ApiError } from "../../lib/api";

/**
 * PaymentHistory (STORY-07) — a per-user financial ledger: every milestone's
 * deposit/escrow/payout state with the full fee breakdown, backed by
 * GET /api/payments/history.
 */
export function PaymentHistory() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    setError("");
    api
      .paymentHistory()
      .then((res) => {
        setRows(res.transactions || []);
        setSummary(res.summary || null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Could not load payment history."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const money = (n) => `₹${Number(n || 0).toLocaleString()}`;
  const stateBadge = (s) =>
    s === "Funds_Released" ? "panel-badge--green" : s === "Draft" || s === "Pending_Deposit" ? "panel-badge--gray" : "panel-badge--blue";

  return (
    <div>
      <div className="panel-page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 className="panel-page-title">Payment history</h1>
            <p className="panel-page-subtitle">Deposits, escrow holdings, and payouts across your projects.</p>
          </div>
          <button type="button" className="panel-btn panel-btn--ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: 8, fontSize: 14, marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="panel-grid panel-grid--3" style={{ marginBottom: 20 }}>
          <div className="panel-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Wallet size={20} style={{ color: "#2563eb" }} />
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Transactions</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{summary.total}</div>
            </div>
          </div>
          <div className="panel-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Shield size={20} style={{ color: "#64748b" }} />
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>In escrow</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{money(summary.totalInEscrow)}</div>
            </div>
          </div>
          <div className="panel-card" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ArrowDownCircle size={20} style={{ color: "#16a34a" }} />
            <div>
              <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600 }}>Released (net)</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{money(summary.totalReleased)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="panel-card" style={{ padding: 0 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1.4fr", gap: 8, padding: "12px 20px", borderBottom: "1px solid #e2e8f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#94a3b8" }}>
          <span>Milestone</span>
          <span>State</span>
          <span>Gross</span>
          <span>Net payout</span>
          <span>Razorpay refs</span>
        </div>

        {loading ? (
          <p style={{ fontSize: 14, color: "#64748b", padding: 24, textAlign: "center" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <FileText size={28} style={{ color: "#94a3b8", margin: "0 auto 10px" }} />
            <p style={{ fontSize: 14, color: "#64748b" }}>No transactions yet. Fund a milestone to get started.</p>
          </div>
        ) : (
          rows.map((t) => (
            <div key={t.milestoneId} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1.4fr", gap: 8, padding: "14px 20px", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a" }}>{t.title}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{t.projectTitle || t.proposalId}</div>
              </div>
              <span className={`panel-badge ${stateBadge(t.state)}`} style={{ justifySelf: "start" }}>{t.state}</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{money(t.grossAmount)}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: t.released ? "#16a34a" : "#475569" }}>{money(t.netFreelancerEarnings)}</span>
              <div style={{ fontSize: 11, color: "#64748b", fontFamily: "monospace", lineHeight: 1.5, wordBreak: "break-all" }}>
                {t.razorpayPaymentId && <div>pay: {t.razorpayPaymentId}</div>}
                {t.razorpayTransferId && <div>tr: {t.razorpayTransferId}</div>}
                {t.razorpayRefundId && <div>rfnd: {t.razorpayRefundId}</div>}
                {!t.razorpayPaymentId && !t.razorpayTransferId && !t.razorpayRefundId && <span>—</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
