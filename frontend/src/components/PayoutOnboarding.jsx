import { useState } from "react";
import { Wallet, Check, Landmark } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { getUser, setSession } from "../lib/auth";

/**
 * PayoutOnboarding (STORY-06) — freelancer form to register a Razorpay Route
 * linked account so milestone releases can be routed to their bank. Bank
 * details are sent to the backend (which forwards them to Razorpay) and never
 * stored locally; only the resulting `acc_xxxx` id is persisted on the user.
 */
export function PayoutOnboarding() {
  const existing = getUser();
  const [accountId, setAccountId] = useState(existing?.razorpayAccountId || "");
  const [form, setForm] = useState({
    legalBusinessName: "",
    beneficiaryName: "",
    accountNumber: "",
    ifscCode: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.legalBusinessName.trim()) {
      setError("Legal / business name is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await api.createRazorpayAccount({
        legalBusinessName: form.legalBusinessName.trim(),
        beneficiaryName: form.beneficiaryName.trim() || undefined,
        accountNumber: form.accountNumber.trim() || undefined,
        ifscCode: form.ifscCode.trim() || undefined,
        phone: form.phone.trim() || undefined,
      });
      setAccountId(res.accountId);
      // Reflect the new linked account on the stored user so the release flow
      // and profile show it without a full re-login.
      if (existing) setSession({ user: { ...existing, razorpayAccountId: res.accountId } });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create payout account.");
    } finally {
      setLoading(false);
    }
  };

  if (accountId) {
    return (
      <div className="panel-card">
        <div className="panel-card-header">
          <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Wallet size={16} style={{ color: "#16a34a" }} /> Payout account
          </h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: 12 }}>
          <Check size={16} style={{ color: "#16a34a" }} />
          <div style={{ fontSize: 13, color: "#166534" }}>
            Linked account active — payouts route here.
            <div style={{ fontSize: 11, color: "#15803d", fontFamily: "monospace", marginTop: 2 }}>{accountId}</div>
          </div>
        </div>
      </div>
    );
  }

  const input = { width: "100%", padding: "8px 12px", border: "1.5px solid #e2e8f0", borderRadius: 8, fontSize: 13, boxSizing: "border-box" };

  return (
    <div className="panel-card">
      <div className="panel-card-header">
        <h2 className="panel-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Landmark size={16} style={{ color: "#2563eb" }} /> Set up payouts
        </h2>
      </div>
      <p style={{ fontSize: 13, color: "#64748b", margin: "0 0 14px" }}>
        Register your bank details so released escrow funds are paid to you via Razorpay Route.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <input style={input} placeholder="Legal / business name *" value={form.legalBusinessName} onChange={set("legalBusinessName")} />
        <input style={input} placeholder="Beneficiary name (as per bank)" value={form.beneficiaryName} onChange={set("beneficiaryName")} />
        <div style={{ display: "flex", gap: 10 }}>
          <input style={input} placeholder="Account number" value={form.accountNumber} onChange={set("accountNumber")} />
          <input style={input} placeholder="IFSC code" value={form.ifscCode} onChange={set("ifscCode")} />
        </div>
        <input style={input} placeholder="Phone (optional)" value={form.phone} onChange={set("phone")} />
      </div>

      {error && (
        <div style={{ marginTop: 12, background: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, fontSize: 13 }}>
          {error}
        </div>
      )}

      <button type="button" className="panel-btn" style={{ marginTop: 14 }} disabled={loading} onClick={submit}>
        {loading ? "Creating…" : "Create payout account"}
      </button>
    </div>
  );
}
