import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Inbox,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { api } from "../../lib/api";

/**
 * A freelancer's project invitation inbox.
 *
 * This is the freelancer half of the two-sided hiring handshake: a client can
 * only send an invitation, and nothing moves forward until the freelancer
 * accepts here. Invitations intentionally show a short brief only — the full
 * project file stays private until both sides agree.
 */

const STATUS_COPY = {
  invited: { label: "Awaiting your reply", color: "#c2410c", background: "#fff7ed" },
  accepted: { label: "You accepted", color: "#15803d", background: "#f0fdf4" },
  declined: { label: "You declined", color: "#b91c1c", background: "#fef2f2" },
  interviewing: { label: "Interview stage", color: "#0369a1", background: "#ecfeff" },
  selected: { label: "Selected for the project", color: "#15803d", background: "#f0fdf4" },
};

export function FreelancerInvitations() {
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.listInvitations();
      setInvitations(res?.invitations ?? []);
    } catch (err) {
      setError(err?.message || "Couldn't load your invitations.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const respond = async (invitation, action) => {
    setBusyId(invitation.proposalId);
    setError("");
    setNotice("");
    try {
      await api.respondToInvitation(
        invitation.proposalId,
        action,
        invitation.expectedVersion,
      );
      setNotice(
        action === "accept"
          ? "Invitation accepted. The client has been notified by email."
          : "Invitation declined. The client has been notified.",
      );
      // Refresh so the status and version stay in sync with the server.
      await load();
    } catch (err) {
      // A version conflict means the client changed the shortlist meanwhile.
      setError(err?.message || "Couldn't send your response. Please try again.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const pending = invitations.filter((i) => i.status === "invited");
  const history = invitations.filter((i) => i.status !== "invited");

  return (
    <div>
      <div className="panel-page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="panel-page-title" data-tour="invitations-header">
              Project invitations
            </h1>
            <p className="panel-page-subtitle">
              Clients can only invite you. Nothing starts until you accept.
            </p>
          </div>
          <button type="button" className="panel-btn panel-btn--ghost" onClick={load} disabled={loading}>
            <RefreshCw size={14} className={loading ? "animate-spin" : undefined} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#fef2f2", border: "1px solid #fee2e2", color: "#991b1b", padding: "12px 16px", borderRadius: 8, fontSize: 14, marginBottom: 20 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {notice && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#15803d", padding: "12px 16px", borderRadius: 8, fontSize: 14, marginBottom: 20 }}>
          <Check size={16} /> {notice}
        </div>
      )}

      {loading && invitations.length === 0 && (
        <div className="panel-card" style={{ textAlign: "center", padding: 40, color: "#64748b" }}>
          <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 10px" }} />
          <p style={{ margin: 0, fontSize: 14 }}>Loading your invitations…</p>
        </div>
      )}

      {!loading && invitations.length === 0 && (
        <div className="panel-card" style={{ textAlign: "center", padding: 48 }}>
          <Inbox size={26} style={{ color: "#94a3b8", margin: "0 auto 12px" }} />
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 6px" }}>No invitations yet</h2>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b", maxWidth: 420, marginInline: "auto", lineHeight: 1.6 }}>
            When a client invites you to a project, it appears here and you'll get
            an email. Keeping your code analytics fresh helps clients find you.
          </p>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", margin: "0 0 12px" }}>
            Needs your response ({pending.length})
          </h2>
          <div style={{ display: "grid", gap: 16, marginBottom: 32 }}>
            {pending.map((invitation) => (
              <InvitationCard
                key={invitation.proposalId}
                invitation={invitation}
                busy={busyId === invitation.proposalId}
                onAccept={() => respond(invitation, "accept")}
                onDecline={() => respond(invitation, "decline")}
              />
            ))}
          </div>
        </>
      )}

      {history.length > 0 && (
        <>
          <h2 style={{ fontSize: 13, fontWeight: 750, textTransform: "uppercase", letterSpacing: "0.06em", color: "#64748b", margin: "0 0 12px" }}>
            Past invitations
          </h2>
          <div style={{ display: "grid", gap: 12 }}>
            {history.map((invitation) => (
              <InvitationCard key={invitation.proposalId} invitation={invitation} readOnly />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function InvitationCard({ invitation, busy, onAccept, onDecline, readOnly = false }) {
  const status = STATUS_COPY[invitation.status] || STATUS_COPY.invited;

  return (
    <div className="panel-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Mail size={15} style={{ color: "#2563eb", flexShrink: 0 }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: "#0f172a" }}>
              {invitation.projectTitle}
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>
            Invited by {invitation.clientName}
            {invitation.invitedAt
              ? ` · ${new Date(invitation.invitedAt).toLocaleDateString()}`
              : ""}
          </p>
        </div>
        <span
          style={{
            padding: "3px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            color: status.color,
            background: status.background,
            whiteSpace: "nowrap",
          }}
        >
          {status.label}
        </span>
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 14,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 750, letterSpacing: "0.06em", textTransform: "uppercase", color: "#94a3b8" }}>
            Project brief
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: "#334155" }}>
          {invitation.brief || "The client hasn't added a written brief yet."}
          {invitation.briefTruncated ? "…" : ""}
        </p>
        {invitation.briefTruncated && (
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#94a3b8" }}>
            Full scope, milestones, and budget are shared once you accept.
          </p>
        )}
      </div>

      {invitation.skills?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {invitation.skills.map((skill) => (
            <span
              key={skill}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "3px 8px",
                borderRadius: 5,
                background: "#eff6ff",
                color: "#1d4ed8",
                border: "1px solid #bfdbfe",
              }}
            >
              {skill}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
          <Sparkles size={13} style={{ color: "#2563eb" }} />
          {invitation.matchScore}% match to your verified work
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#15803d" }}>
          <ShieldCheck size={13} />
          Milestones are escrow-protected
        </span>
      </div>

      {!readOnly && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button type="button" className="panel-btn" onClick={onAccept} disabled={busy} style={{ fontSize: 12 }}>
            {busy ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            Accept invitation
          </button>
          <button
            type="button"
            className="panel-btn--ghost panel-btn"
            onClick={onDecline}
            disabled={busy}
            style={{ fontSize: 12 }}
          >
            <X size={13} /> Decline
          </button>
          <span style={{ fontSize: 11, color: "#94a3b8", alignSelf: "center" }}>
            Accepting only starts the conversation — you agree to scope and payment later.
          </span>
        </div>
      )}
    </div>
  );
}
