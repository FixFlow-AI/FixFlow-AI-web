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

import {
  LayoutDashboard,
  FileText,
  GitBranch,
  Cpu,
  FileSignature,
  KanbanSquare,
  Coins,
  Award,
  Settings,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { Brand } from "../components/Brand";

export function Dashboard() {
  const { dashboardTab, setDashboardTab, logout, resetMockData } =
    useLandingStore();

  // Sidebar navigation configuration
  const menuItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "brief-intelligence", label: "Brief Ingestion", icon: FileText },
    { id: "evidence-confidence", label: "Evidence Graph", icon: GitBranch },
    { id: "proposal-generator", label: "Proposal Builder", icon: Cpu },
    {
      id: "agreement-composer",
      label: "Agreement Composer",
      icon: FileSignature,
    },
    { id: "delivery-control", label: "Delivery Control", icon: KanbanSquare },
    { id: "milestone-funds", label: "Milestone Funds", icon: Coins },
    { id: "outcome-evidence", label: "Outcome Reputation", icon: Award },
    { id: "role-onboarding", label: "Role Setup", icon: Settings },
  ];

  // Render sub-screens conditionally
  const renderActiveTab = () => {
    switch (dashboardTab) {
      case "overview":
        return <Overview />;
      case "brief-intelligence":
        return <BriefIntelligence />;
      case "evidence-confidence":
        return <EvidenceConfidence />;
      case "proposal-generator":
        return <ProposalGenerator />;
      case "agreement-composer":
        return <AgreementComposer />;
      case "delivery-control":
        return <DeliveryControl />;
      case "milestone-funds":
        return <MilestoneFunds />;
      case "outcome-evidence":
        return <OutcomeEvidence />;
      case "role-onboarding":
        return <RoleOnboarding />;
      default:
        return <Overview />;
    }
  };

  const handleTabChange = (tabId) => {
    setDashboardTab(tabId);
    window.location.hash = `#/dashboard/${tabId}`;
  };

  const handleLogout = () => {
    logout();
    window.location.hash = "#/";
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col md:flex-row">
      {/* Sidebar Layout */}
      <aside className="w-full md:w-64 bg-white border-r border-[#D9E0E8] flex flex-col justify-between p-6 md:fixed md:top-0 md:bottom-0 md:left-0 z-30">
        <div className="space-y-8">
          {/* Brand header */}
          <div className="flex justify-between items-center">
            <Brand compact />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1" aria-label="Dashboard sub-views">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = dashboardTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-[#EDF4FF] text-[#2563EB] font-bold border-l-2 border-[#2563EB]"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon
                    size={16}
                    className={isActive ? "text-[#2563EB]" : "text-slate-400"}
                  />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer options */}
        <div className="pt-6 border-t border-[#D9E0E8] space-y-2 mt-6 md:mt-0">
          <button
            onClick={resetMockData}
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <RefreshCw size={16} className="text-slate-400" />
            Reset State
          </button>
          <button
            onClick={handleLogout}
            type="button"
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold text-red-600 hover:text-red-700 transition-colors cursor-pointer"
          >
            <LogOut size={16} className="text-red-400" />
            Exit Workspace
          </button>
        </div>
      </aside>

      {/* Main Viewport */}
      <div className="flex-1 md:pl-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="bg-white border-b border-[#D9E0E8] h-16 flex items-center justify-between px-8 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Project ID:
            </span>
            <span className="text-xs font-mono font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
              northstar-billing-mig-02
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-slate-400 font-medium">
              Consensus network:
            </span>
            <span className="flex items-center gap-1.5 px-2 py-0.5 border border-emerald-200 bg-emerald-50 text-emerald-800 font-bold rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Polygon Amoy
            </span>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-grow p-8 max-w-5xl w-full mx-auto">
          {renderActiveTab()}
        </main>
      </div>
    </div>
  );
}
