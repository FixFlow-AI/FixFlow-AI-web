import { useState } from "react";
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

import {
  Home,
  FileText,
  BadgeCheck,
  Handshake,
  PackageCheck,
  Wallet,
  BarChart3,
  ChevronLeft,
  ChevronDown,
  Bell,
  CircleHelp,
  LogOut,
  RefreshCw,
  UserCircle2,
  Sparkles,
  Users,
} from "lucide-react";

/* ——————————————————————————————————————————
   Sidebar menu – matches the 7 product screens
   + 2 extra panels (Proposal, Role Setup)
   —————————————————————————————————————————— */
const menuItems = [
  { id: "overview", label: "Overview", icon: Home },
  { id: "brief-intelligence", label: "Brief", icon: FileText },
  { id: "evidence-confidence", label: "Evidence", icon: BadgeCheck },
  { id: "matching", label: "Matches", icon: Users },
  { id: "proposal-generator", label: "Talent", icon: Sparkles },
  { id: "agreement-composer", label: "Agreement", icon: Handshake },
  { id: "delivery-control", label: "Delivery", icon: PackageCheck },
  { id: "milestone-funds", label: "Funds", icon: Wallet },
  { id: "outcome-evidence", label: "Outcomes", icon: BarChart3 },
];

const tabMap = {
  overview: Overview,
  "brief-intelligence": BriefIntelligence,
  "evidence-confidence": EvidenceConfidence,
  matching: MatchResults,
  "proposal-generator": ProposalGenerator,
  "agreement-composer": AgreementComposer,
  "delivery-control": DeliveryControl,
  "milestone-funds": MilestoneFunds,
  "outcome-evidence": OutcomeEvidence,
  "role-onboarding": RoleOnboarding,
};

export function Dashboard() {
  const { dashboardTab, setDashboardTab, logout, resetMockData } =
    useLandingStore();
  const [collapsed, setCollapsed] = useState(false);

  const ActivePanel = tabMap[dashboardTab] || Overview;

  const handleTabChange = (tabId) => {
    setDashboardTab(tabId);
    window.location.hash = `#/dashboard/${tabId}`;
  };

  const handleLogout = () => {
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
        <nav className="dash-sidebar-nav" aria-label="Dashboard navigation">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = dashboardTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`dash-nav-item${isActive ? " is-active" : ""}`}
                onClick={() => handleTabChange(item.id)}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} strokeWidth={1.8} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="dash-sidebar-footer">
          <button
            type="button"
            className="dash-nav-item dash-nav-item--subtle"
            onClick={resetMockData}
            title="Reset mock data"
          >
            <RefreshCw size={16} strokeWidth={1.8} />
            {!collapsed && <span>Reset State</span>}
          </button>
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
            <span className="dash-breadcrumb-org">Atlas Commerce</span>
            <span className="dash-breadcrumb-sep">/</span>
            <span className="dash-breadcrumb-project">
              Northstar Billing Migration
              <ChevronDown size={14} />
            </span>
          </div>

          <div className="dash-topbar-actions">
            <button type="button" className="dash-topbar-icon" aria-label="Notifications">
              <Bell size={18} strokeWidth={1.7} />
            </button>
            <button type="button" className="dash-topbar-icon" aria-label="Help">
              <CircleHelp size={18} strokeWidth={1.7} />
            </button>
            <button type="button" className="dash-topbar-avatar" aria-label="Account">
              <span>AC</span>
            </button>
          </div>
        </header>

        {/* Content viewport */}
        <main className="dash-viewport">
          <ActivePanel />
        </main>
      </div>
    </div>
  );
}
