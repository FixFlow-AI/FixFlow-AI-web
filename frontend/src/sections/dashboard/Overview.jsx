import { useEffect, useState } from "react";
import {
  ArrowRight,
  FileText,
  RefreshCw,
  AlertTriangle,
  Cpu,
  Coins,
  Award,
} from "lucide-react";
import { useLandingStore } from "../../store/useLandingStore";
import { api, ApiError } from "../../lib/api";

export function Overview() {
  const { user, setDashboardTab } = useLandingStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.overview();
      setData(res);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your overview.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (tab) => {
    setDashboardTab(tab);
    window.location.hash = `#/dashboard/${tab}`;
  };

  return (
    <div>
      <div className="panel-page-header">
        <h1 className="panel-page-title">
          Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p className="panel-page-subtitle">
          {user?.email} · {user?.role}
        </p>
      </div>

      {loading ? (
        <div className="panel-card" style={{ textAlign: "center", padding: 48 }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: "#2563eb" }} />
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 12 }}>Loading your workspace…</p>
        </div>
      ) : error ? (
        <div className="panel-card">
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#c2410c" }}>
            <AlertTriangle size={16} /> {error}
          </div>
          <button type="button" className="panel-btn" style={{ marginTop: 12 }} onClick={load}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : (
        <>
          {/* Real counts */}
          <div className="panel-grid panel-grid--3" style={{ marginBottom: 20 }}>
            <div className="panel-stat">
              <div className="panel-stat-value">{data?.counts?.proposals ?? 0}</div>
              <div className="panel-stat-label">Proposals</div>
            </div>
            <div className="panel-stat">
              <div className="panel-stat-value">{data?.milestoneSummary?.total ?? 0}</div>
              <div className="panel-stat-label">Milestones</div>
            </div>
            <div className="panel-stat">
              <div className="panel-stat-value" style={{ color: "#16a34a" }}>
                {data?.milestoneSummary?.released ?? 0}
              </div>
              <div className="panel-stat-label">Released</div>
            </div>
          </div>

          {data?.latestProposal ? (
            <div className="panel-card">
              <div className="panel-card-header">
                <h2 className="panel-card-title">Latest project</h2>
                <span className="panel-badge panel-badge--blue">
                  {data.latestProposal.hasEvaluation ? "Evaluated" : "Parsed"}
                </span>
              </div>
              <div className="panel-info-row">
                <span className="panel-info-label">Title</span>
                <span className="panel-info-value">{data.latestProposal.title}</span>
              </div>
              <div className="panel-info-row">
                <span className="panel-info-label">Features</span>
                <span className="panel-info-value">{data.latestProposal.features}</span>
              </div>
              <div className="panel-info-row">
                <span className="panel-info-label">Risks</span>
                <span className="panel-info-value">{data.latestProposal.risks}</span>
              </div>
              <div className="panel-info-row">
                <span className="panel-info-label">Created</span>
                <span className="panel-info-value">
                  {new Date(data.latestProposal.createdAt).toLocaleString()}
                </span>
              </div>
              <hr className="panel-divider" />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="panel-btn" onClick={() => go("evidence-confidence")}>
                  <Cpu size={14} /> Evaluate
                </button>
                <button type="button" className="panel-btn--ghost panel-btn" onClick={() => go("matching")}>
                  Find matches <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
            /* Honest empty state for a brand-new account — no mock data. */
            <div className="panel-card" style={{ textAlign: "center", padding: 40 }}>
              <FileText size={32} style={{ color: "#94a3b8" }} />
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "12px 0 4px" }}>
                No projects yet
              </h2>
              <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 16px" }}>
                Start by parsing a project brief — that creates your first real proposal.
              </p>
              <button type="button" className="panel-btn" onClick={() => go("brief-intelligence")}>
                Parse a brief <ArrowRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
