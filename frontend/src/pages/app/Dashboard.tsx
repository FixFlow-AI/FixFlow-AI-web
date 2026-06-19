import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Coins, 
  FileEdit, 
  Layers, 
  Activity,
  ArrowRight,
  CheckCircle2,
  Lock
} from 'lucide-react';
import useApp from '../../store/index.js';
import StatBlock from '../../components/ui/StatBlock.js';
import Card from '../../components/ui/Card.js';
import Badge from '../../components/ui/Badge.js';
import Button from '../../components/ui/Button.js';

export const Dashboard: React.FC = () => {
  const { leads, proposals, escrows, user } = useApp();

  const totalFunded = escrows.reduce((sum, esc) => sum + esc.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-outfit text-white">Operations Control Center</h1>
          <p className="text-xs text-slate-400">Real-time status overview of leads, escrow accounts, and credentials.</p>
        </div>
        <div className="text-xs px-3 py-1.5 bg-blue-900/10 border border-blue-900/30 text-blue-400 rounded-lg font-medium flex items-center space-x-1.5">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          <span>System Integrations: Online</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatBlock
          title="Active Leads"
          value={leads.filter(l => l.status !== 'LOST' && l.status !== 'WON').length}
          change="12%"
          icon={<Layers className="w-5 h-5" />}
        />
        <StatBlock
          title="Active Proposals"
          value={proposals.length}
          change="8%"
          icon={<FileEdit className="w-5 h-5" />}
        />
        <StatBlock
          title="Secured Escrow"
          value={`$${totalFunded.toLocaleString()}`}
          change="15%"
          icon={<Coins className="w-5 h-5" />}
        />
        <StatBlock
          title="Reputation Score"
          value="93.8%"
          change="1.2%"
          subtitle="Verifiable SBT Badge active"
          icon={<Shield className="w-5 h-5" />}
        />
      </div>

      {/* Main split sections */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Alerts & Leads */}
        <div className="lg:col-span-2 space-y-6">
          {/* Actionable Leads */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <h2 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-300">High-Priority Matches</h2>
              <Link to="/app/leads" className="text-xs text-blue-500 hover:underline inline-flex items-center space-x-1">
                <span>View pipeline</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-3">
              {leads.slice(0, 2).map(lead => (
                <div key={lead.id} className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold text-slate-400 font-outfit">{lead.company?.name || 'Inbound Lead'}</span>
                      {lead.company?.stabilityScore && lead.company.stabilityScore < 60 && (
                        <Badge label="SCOPE_CREEP_RISK" />
                      )}
                      {lead.company?.paymentSpeed && lead.company.paymentSpeed >= 90 && (
                        <Badge label="PREMIUM_CLIENT" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-1">{lead.projectDescription}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-slate-300">${lead.budget.amount.toLocaleString()}</span>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest">{lead.budget.currency}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Escrow Status Tracking */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-900 pb-3">
              <h2 className="text-sm font-bold font-outfit uppercase tracking-wider text-slate-300">Milestone Releases Pending</h2>
              <Link to="/app/escrow" className="text-xs text-blue-500 hover:underline inline-flex items-center space-x-1">
                <span>All escrows</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>

            <div className="space-y-3">
              {escrows.map(esc => {
                const activeMilestone = esc.milestones.find(m => m.state === 'Active');
                if (!activeMilestone) return null;
                
                return (
                  <div key={esc.id} className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-slate-200">{activeMilestone.title}</span>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest">Escrow ID: {esc.id}</p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <span className="text-xs font-bold text-blue-400">${activeMilestone.amount.toLocaleString()}</span>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{activeMilestone.percentage}% weight</p>
                      </div>
                      <Link to={`/app/escrow/${esc.id}`}>
                        <Button size="sm" variant="success" className="gap-1 text-xs py-1.5 px-3">
                          <Lock className="w-3 h-3" /> Payout
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column: Reputation & Security Summary */}
        <div className="space-y-6">
          {/* Reputation SBT Block */}
          <Card className="space-y-4 text-center py-6 bg-gradient-to-b from-slate-900/30 to-slate-950/40 relative overflow-hidden">
            <div className="absolute top-2 right-2 text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="mx-auto w-16 h-16 rounded-full bg-blue-900/10 border border-blue-800/40 flex items-center justify-center text-blue-500 mb-2">
              <Shield className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold font-outfit text-white">SBT Reputation NFT</h3>
              <p className="text-[10px] text-slate-500 font-mono tracking-widest uppercase">Owner DID Verified</p>
            </div>
            <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg text-left space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">On-Time Delivery</span>
                <span className="font-semibold text-slate-200">95.0%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Revision Efficiency</span>
                <span className="font-semibold text-slate-200">87.5%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-500">Dispute-Free Rate</span>
                <span className="font-semibold text-slate-200">100%</span>
              </div>
            </div>
          </Card>

          {/* Security Summary card */}
          <Card className="space-y-4">
            <h3 className="text-xs font-bold font-outfit uppercase tracking-wider text-slate-400">Security Credentials</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">MFA Verification</span>
                <span className={`font-semibold ${user?.mfaEnabled ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {user?.mfaEnabled ? 'Active' : 'Not Set'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Active Sessions</span>
                <span className="font-semibold text-slate-200">1 Device</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Prisma OCC Lock</span>
                <span className="text-slate-400">Enforced</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
export default Dashboard;
