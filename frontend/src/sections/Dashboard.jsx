import { Fragment, useState, useEffect, useMemo } from "react";
import { useLandingStore } from "../store/useLandingStore";
import { Overview } from "./dashboard/Overview";
import { BriefIntelligence } from "./dashboard/BriefIntelligence";
import { EvidenceConfidence } from "./dashboard/EvidenceConfidence";
import { ProposalGenerator } from "./dashboard/ProposalGenerator";
import { AgreementComposer } from "./dashboard/AgreementComposer";
import { DeliveryControl } from "./dashboard/DeliveryControl";
import { MilestoneFunds } from "./dashboard/MilestoneFunds";
import { OutcomeEvidence } from "./dashboard/OutcomeEvidence";
import { RoleOnboarding } from "./dashboard/RoleOnboarding";
import { MatchResults } from "./dashboard/MatchResults";
import { FreelancerAnalytics } from "./dashboard/FreelancerAnalytics";
import { PaymentHistory } from "./dashboard/PaymentHistory";
import { Automations } from "./dashboard/Automations";
import { ExecutionPlanPanel } from "./dashboard/ExecutionPlanPanel";

import {
  Home,
  FileText,
  BadgeCheck,
  Handshake,
  PackageCheck,
  Wallet,
  BarChart3,
  LineChart,
  ChevronLeft,
  ChevronDown,
  Bell,
  CircleHelp,
  LogOut,
  RefreshCw,
  UserCircle2,
  Sparkles,
  Users,
  Bot,
  CalendarRange,
} from "lucide-react";
import { api } from "../lib/api";
import { getRefreshToken, getUser, clearSession } from "../lib/auth";
import { FREELANCER_ONLY_ONBOARDING } from "../config/launchMode";
import { ProductTour, restartClientTour } from "../components/ProductTour";
import "../tour.css";

/* ——————————————————————————————————————————
   Sidebar menu – matches the 7 product screens
   + 2 extra panels (Proposal, Role Setup)
   —————————————————————————————————————————— */
/**
 * Sidebar order follows the real client journey, top to bottom, so the nav
 * itself teaches the workflow:
 *
 *   Overview → Brief Intelligence → AI Builder → AI Evaluation → Project Plan
 *   → Talent Matches → Agreement → Escrow Funds → Delivery Control
 *   → Payments → Outcomes → Automations
 *
 * Groups are labels only; they never change routing or permissions. Per the
 * role permission matrix (docs/specifications/roles/00) freelancers cannot post
 * briefs or run shortlists, so the scoping and hiring panels stay client-only.
 */
const menuItems = [
  { id: "overview", label: "Overview", icon: Home, group: "Workspace", comingSoonFor: ["freelancer"] },

  // 1. Scope the work: capture the request, build a proposal, check confidence.
  { id: "brief-intelligence", label: "Brief Intelligence", icon: FileText, group: "Scope the project", roles: ["client"] },
  { id: "proposal-generator", label: "AI Builder", icon: Sparkles, group: "Scope the project", roles: ["client"] },
  { id: "evidence-confidence", label: "AI Evaluation", icon: BadgeCheck, group: "Scope the project", roles: ["client"] },
  { id: "project-plan", label: "Project Plan", icon: CalendarRange, group: "Scope the project", roles: ["client"] },

  // 2. Decide who delivers it.
  { id: "matching", label: "Talent Matches", icon: Users, group: "Find talent", roles: ["client"] },
  { id: "analytics", label: "Code Analytics", icon: LineChart, group: "Find talent", roles: ["freelancer"] },

  // 3. Lock scope, protect money, then track delivery against it.
  { id: "agreement-composer", label: "Agreement", icon: Handshake, group: "Execute & protect", comingSoonFor: ["freelancer"] },
  { id: "milestone-funds", label: "Escrow Funds", icon: Wallet, group: "Execute & protect", comingSoonFor: ["freelancer"] },
  { id: "delivery-control", label: "Delivery Control", icon: PackageCheck, group: "Execute & protect", comingSoonFor: ["freelancer"] },

  // 4. The durable record left behind.
  { id: "payment-history", label: "Payments", icon: BarChart3, group: "Records", comingSoonFor: ["freelancer"] },
  { id: "outcome-evidence", label: "Outcomes", icon: BarChart3, group: "Records", comingSoonFor: ["freelancer"] },
  { id: "automations", label: "Automations", icon: Bot, group: "Records", comingSoonFor: ["freelancer"] },
];

function isComingSoonForRole(item, role) {
  return Boolean(
    FREELANCER_ONLY_ONBOARDING && item?.comingSoonFor?.includes(role),
  );
}

function defaultTabForRole(role) {
  return FREELANCER_ONLY_ONBOARDING && role === "freelancer"
    ? "analytics"
    : "overview";
}

/** Tabs a given role is allowed to open (mirrors the nav gating). */
function isTabAllowedForRole(tabId, role) {
  const item = menuItems.find((m) => m.id === tabId);
  // Panels not in the nav (e.g. first-time role onboarding) stay reachable.
  if (!item) return true;
  if (isComingSoonForRole(item, role)) return false;
  return !item.roles || item.roles.includes(role);
}

const tabMap = {
  overview: Overview,
  analytics: FreelancerAnalytics,
  "brief-intelligence": BriefIntelligence,
  "evidence-confidence": EvidenceConfidence,
  matching: MatchResults,
  "proposal-generator": ProposalGenerator,
  "project-plan": ExecutionPlanPanel,
  "agreement-composer": AgreementComposer,
  "delivery-control": DeliveryControl,
  "milestone-funds": MilestoneFunds,
  "payment-history": PaymentHistory,
  automations: Automations,
  "outcome-evidence": OutcomeEvidence,
  "role-onboarding": RoleOnboarding,
};


export function Dashboard() {
  const { user, parsedProposal, isNewProposalMode, dashboardTab, setDashboardTab, logout, hydrateLatestProposal, setProposalHistory } =
    useLandingStore();
  const [collapsed, setCollapsed] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("ff_auth_notification");
    if (stored) {
      try {
        setNotification(JSON.parse(stored));
        sessionStorage.removeItem("ff_auth_notification");
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (!profileDropdownOpen) return;
    const handleClose = (e) => {
      if (!e.target.closest(".dash-topbar-avatar-container")) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("click", handleClose);
    return () => document.removeEventListener("click", handleClose);
  }, [profileDropdownOpen]);

  useEffect(() => {
    // Load ALL proposals for the logged-in user from the database.
    // Hydrate the latest one into the active workspace AND store the
    // full list so the Overview tab can display proposal history.
    // Skip when the user explicitly clicked "New Proposal" — they want
    // a clean slate, not the previous brief re-loaded.
    if (!parsedProposal && !isNewProposalMode) {
      api.listProposals()
        .then((res) => {
          if (res?.proposals && res.proposals.length > 0) {
            hydrateLatestProposal(res.proposals[0]);
            setProposalHistory(res.proposals);
          }
        })
        .catch((err) => {
          console.error("Failed to automatically rehydrate proposal:", err);
        });
    }
  }, [parsedProposal, isNewProposalMode, hydrateLatestProposal, setProposalHistory]);

  // Guard stale/direct hashes. During the freelancer-only launch, every
  // freelancer panel except Code Analytics is intentionally inaccessible.
  useEffect(() => {
    if (user?.role && !isTabAllowedForRole(dashboardTab, user.role)) {
      const fallbackTab = defaultTabForRole(user.role);
      setDashboardTab(fallbackTab);
      window.location.hash = `#/dashboard/${fallbackTab}`;
    }
  }, [dashboardTab, user?.role, setDashboardTab]);

  const fallbackTab = defaultTabForRole(user?.role);
  const effectiveTab = isTabAllowedForRole(dashboardTab, user?.role)
    ? dashboardTab
    : fallbackTab;
  const ActivePanel = tabMap[effectiveTab] || tabMap[fallbackTab] || Overview;

  // Role filtering happens once so the group-label lookup can compare against
  // the previous *visible* item rather than the raw menu.
  const visibleMenuItems = useMemo(
    () => menuItems.filter((item) => !item.roles || item.roles.includes(user?.role)),
    [user?.role],
  );

  const handleTabChange = (tabId) => {
    if (!isTabAllowedForRole(tabId, user?.role)) return;
    setDashboardTab(tabId);
    window.location.hash = `#/dashboard/${tabId}`;
  };

  const handleLogout = async () => {
    const rt = getRefreshToken();
    const u = getUser();
    if (rt && u?.id) {
      try { await api.logout(rt, u.id); } catch { /* best-effort */ }
    }
    clearSession();
    logout();
    window.location.hash = "#/";
  };

  return (
    <div className="dash">
      {/* ─── Sidebar ─── */}
      <aside className={`dash-sidebar${collapsed ? " is-collapsed" : ""}`}>
        {/* Brand */}
        <div className="dash-sidebar-brand">
          <img
            src="/official-logo.png"
            alt="FixFlowAI"
            className="dash-sidebar-logo"
          />
          {!collapsed && <span className="dash-sidebar-wordmark">FixFlowAI</span>}
        </div>

        {/* Nav */}
        <nav
          className="dash-sidebar-nav"
          aria-label="Dashboard navigation"
          data-tour="sidebar-nav"
        >
          {visibleMenuItems.map((item, index) => {
            const Icon = item.icon;
            const isComingSoon = isComingSoonForRole(item, user?.role);
            const isActive = !isComingSoon && effectiveTab === item.id;
            // Print a group label only when the group actually changes, and
            // never in the icon-only collapsed rail.
            const startsGroup =
              !collapsed &&
              item.group &&
              item.group !== visibleMenuItems[index - 1]?.group;
            return (
              <Fragment key={item.id}>
                {startsGroup && (
                  <span className="dash-nav-group" aria-hidden="true">
                    {item.group}
                  </span>
                )}
                <button
                  type="button"
                  className={`dash-nav-item${isActive ? " is-active" : ""}${isComingSoon ? " is-coming-soon" : ""}`}
                  onClick={() => handleTabChange(item.id)}
                  disabled={isComingSoon}
                  aria-disabled={isComingSoon}
                  data-tour={`nav-${item.id}`}
                  title={collapsed ? `${item.label}${isComingSoon ? " — Coming Soon" : ""}` : undefined}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  {!collapsed && (
                    <>
                      <span className="dash-nav-label">{item.label}</span>
                      {isComingSoon && <span className="dash-nav-badge">Coming Soon</span>}
                    </>
                  )}
                </button>
              </Fragment>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="dash-sidebar-footer">

          <button
            type="button"
            className="dash-nav-item dash-nav-item--danger"
            onClick={handleLogout}
            title="Exit workspace"
          >
            <LogOut size={16} strokeWidth={1.8} />
            {!collapsed && <span>Exit Workspace</span>}
          </button>

          <button
            type="button"
            className="dash-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <ChevronLeft
              size={16}
              style={{
                transform: collapsed ? "rotate(180deg)" : "none",
                transition: "transform 200ms ease",
              }}
            />
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ─── Main area ─── */}
      <div className="dash-main">
        {/* Top bar */}
        <header className="dash-topbar">
          <div className="dash-breadcrumb">
            <span className="dash-breadcrumb-org">
              {user?.email ? user.email.split("@")[1].split(".")[0].toUpperCase() : "WORKSPACE"}
            </span>
            <span className="dash-breadcrumb-sep">/</span>
            <span className="dash-breadcrumb-project">
              {parsedProposal?.project_summary
                ? parsedProposal.project_summary.split(".")[0].slice(0, 80)
                : "No Active Project"}
              <ChevronDown size={14} />
            </span>
          </div>

          <div className="dash-topbar-actions">
            <button type="button" className="dash-topbar-icon" aria-label="Notifications">
              <Bell size={18} strokeWidth={1.7} />
            </button>
            <button
              type="button"
              className="dash-topbar-icon"
              aria-label={user?.role === "client" ? "Replay product tour" : "Help"}
              title={user?.role === "client" ? "Replay product tour" : undefined}
              data-tour="help-replay"
              onClick={user?.role === "client" ? restartClientTour : undefined}
            >
              <CircleHelp size={18} strokeWidth={1.7} />
            </button>
            <div className="dash-topbar-avatar-container">
              <button
                type="button"
                className="dash-topbar-avatar"
                aria-label="Account"
                onClick={() => setProfileDropdownOpen((prev) => !prev)}
              >
                <span>
                  {user?.name
                    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase()
                    : "U"}
                </span>
              </button>

              {profileDropdownOpen && (
                <div className="profile-dropdown">
                  <div className="profile-dropdown-header">
                    <div className="profile-dropdown-name">{user?.name || "User"}</div>
                    <div className="profile-dropdown-email">{user?.email}</div>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <div className="profile-dropdown-section">
                    <span className="profile-dropdown-label">Role</span>
                    <span className={`profile-dropdown-badge role-${user?.role || "client"}`}>
                      {(user?.role || "client").toUpperCase()}
                    </span>
                  </div>
                  <div className="profile-dropdown-divider" />
                  <button
                    type="button"
                    className="profile-dropdown-item profile-dropdown-item--danger"
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut size={14} strokeWidth={1.8} />
                    <span>Log Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content viewport */}
        <main className="dash-viewport">
          {notification && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 18px",
                borderRadius: 8,
                marginBottom: 20,
                fontSize: 14,
                fontWeight: 500,
                background: notification.type === "warning" ? "#fffbeb" : "#f0fdf4",
                border: notification.type === "warning" ? "1px solid #fde68a" : "1px solid #bbf7d0",
                color: notification.type === "warning" ? "#b45309" : "#15803d",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={16} />
                <span>{notification.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setNotification(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: "0 4px",
                }}
              >
                &times;
              </button>
            </div>
          )}
          <ActivePanel />
        </main>
      </div>

      {/* Client-only guided walkthrough. Renders nothing for other roles. */}
      <ProductTour sidebarCollapsed={collapsed} />
    </div>
  );
}
