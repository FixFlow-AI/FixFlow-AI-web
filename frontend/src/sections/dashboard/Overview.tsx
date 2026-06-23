import { useLandingStore } from '../../store/useLandingStore'
import { LayoutDashboard, AlertCircle, Calendar, ArrowRight, UserCheck, Shield, CheckCircle } from 'lucide-react'

export function Overview() {
  const {
    userRole,
    userEmail,
    escrowState,
    milestones,
    changeRequests,
    isAgreementSigned,
    setDashboardTab,
  } = useLandingStore()

  // Calculate totals
  const totalAmount = milestones.reduce((sum, m) => sum + m.amount, 0)
  const fundedAmount = milestones.reduce((sum, m) => sum + (m.status !== 'unfunded' ? m.amount : 0), 0)
  const releasedAmount = milestones.reduce((sum, m) => sum + (m.status === 'released' ? m.amount : 0), 0)

  // Status mapping
  const signedPercent = (isAgreementSigned.client ? 50 : 0) + (isAgreementSigned.freelancer ? 50 : 0)
  const openChanges = changeRequests.filter((r) => r.status === 'pending')

  // Generate action list dynamically based on workspace state
  const getNextAction = () => {
    if (!isAgreementSigned.client || !isAgreementSigned.freelancer) {
      return {
        text: 'Sign the Working Agreement',
        desc: 'Both client and freelancer must sign the contract terms to enable escrow.',
        tab: 'agreement-composer' as const,
      }
    }
    const nextUnfunded = milestones.find((m) => m.status === 'unfunded')
    if (nextUnfunded) {
      return {
        text: `Fund Milestone: ${nextUnfunded.title}`,
        desc: `Client must deposit funds ($${nextUnfunded.amount.toLocaleString()}) to escrow to start work safely.`,
        tab: 'milestone-funds' as const,
      }
    }
    const nextFunded = milestones.find((m) => m.status === 'funded')
    if (nextFunded) {
      return {
        text: `Verify & Release: ${nextFunded.title}`,
        desc: `Freelancer has submitted deliverables. Verify acceptance criteria to release funds.`,
        tab: 'milestone-funds' as const,
      }
    }
    return {
      text: 'Mint Reputation Soulbound Token',
      desc: 'All milestones completed and released. Mint your Verifiable Reputation SBT on Polygon.',
      tab: 'outcome-evidence' as const,
    }
  }

  const nextAction = getNextAction()

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Project Control Room</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <LayoutDashboard className="text-[#2563EB]" /> Northstar Billing Migration
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Currently logged in as <span className="font-semibold text-slate-700">{userEmail}</span> ({userRole})
        </p>
      </div>

      {/* Grid: Health Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-[#D9E0E8] p-5 rounded-lg flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Escrow State</span>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                escrowState === 'RELEASED'
                  ? 'bg-emerald-500'
                  : escrowState === 'FUNDED'
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-orange-500'
              }`}
            />
            <span className="text-xl font-bold text-slate-900">{escrowState}</span>
          </div>
          <span className="text-slate-400 text-xs mt-2">Trust layer active on Polygon Amoy</span>
        </div>

        <div className="bg-white border border-[#D9E0E8] p-5 rounded-lg flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Scoped Value</span>
          <div className="mt-2 text-2xl font-bold text-slate-900">${totalAmount.toLocaleString()}</div>
          <span className="text-slate-400 text-xs mt-2">USDC locked by agreement rules</span>
        </div>

        <div className="bg-white border border-[#D9E0E8] p-5 rounded-lg flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Deposited in Escrow</span>
          <div className="mt-2 text-2xl font-bold text-blue-600">
            ${fundedAmount.toLocaleString()} <span className="text-slate-400 text-xs font-normal">({Math.round((fundedAmount / totalAmount) * 100)}%)</span>
          </div>
          <span className="text-slate-400 text-xs mt-2">Protected gateway capital</span>
        </div>

        <div className="bg-white border border-[#D9E0E8] p-5 rounded-lg flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Disbursed Earnings</span>
          <div className="mt-2 text-2xl font-bold text-emerald-600">
            ${releasedAmount.toLocaleString()} <span className="text-slate-400 text-xs font-normal">({Math.round((releasedAmount / totalAmount) * 100)}%)</span>
          </div>
          <span className="text-slate-400 text-xs mt-2">Transferred to talent ledger</span>
        </div>
      </div>

      {/* Grid: Actions & Risk Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Recommended Action */}
        <div className="lg:col-span-2 bg-[#EDF4FF] border border-blue-200 p-6 rounded-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-[#2563EB] uppercase tracking-wider mb-2">
              <UserCheck size={16} /> Recommended Workspace Action
            </div>
            <h3 className="text-lg font-bold text-slate-900">{nextAction.text}</h3>
            <p className="text-slate-600 text-sm mt-1.5">{nextAction.desc}</p>
          </div>
          <button
            onClick={() => setDashboardTab(nextAction.tab)}
            className="mt-6 self-start flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#173EA5] text-white font-bold text-xs rounded transition-colors cursor-pointer"
          >
            Go to Section <ArrowRight size={14} />
          </button>
        </div>

        {/* System Risk Signals */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg space-y-4">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2 flex items-center gap-1.5">
            <AlertCircle size={14} className="text-orange-500" /> Active Risk Monitor
          </div>

          <div className="space-y-3">
            {openChanges.length > 0 ? (
              <div className="p-3 bg-orange-50 border border-orange-200 text-[#C2410C] rounded text-xs flex gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Scope Change Pending</span>
                  {openChanges.length} change request(s) require review before milestones lock.
                </div>
              </div>
            ) : null}

            {signedPercent < 100 ? (
              <div className="p-3 bg-orange-50 border border-orange-200 text-[#C2410C] rounded text-xs flex gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Contract Unsigned</span>
                  Agreement signatures are incomplete (Client: {isAgreementSigned.client ? 'Signed' : 'Open'}, Freelancer: {isAgreementSigned.freelancer ? 'Signed' : 'Open'}).
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#16A34A] rounded text-xs flex gap-2">
                <CheckCircle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block">Agreement Locked</span>
                  Smart contract rules are active. Scope changes require dual confirmation.
                </div>
              </div>
            )}

            <div className="p-3 bg-slate-50 border border-slate-200 text-slate-600 rounded text-xs flex gap-2">
              <Shield size={16} className="shrink-0 mt-0.5 text-blue-500" />
              <div>
                <span className="font-bold block">Audit Trail Connected</span>
                All milestones are cryptographically signed with the consensus ledger.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section: Milestone Deliverable Timeline */}
      <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg">
        <h2 className="text-lg font-bold text-slate-900 border-b border-[#D9E0E8] pb-3 mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-slate-500" /> Milestone Tracking Timeline
        </h2>

        <div className="space-y-4">
          {milestones.map((m, idx) => (
            <div key={m.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-[#D9E0E8] hover:border-slate-300 rounded transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-400">0{idx + 1}</span>
                  <h4 className="font-bold text-slate-800 text-sm">{m.title}</h4>
                </div>
                <p className="text-xs text-slate-400">Budget: ${m.amount.toLocaleString()} USDC</p>
              </div>

              <div className="flex items-center gap-4">
                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                    m.status === 'released'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : m.status === 'funded'
                      ? 'bg-blue-50 border-blue-200 text-blue-700'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {m.status === 'released' ? 'Released' : m.status === 'funded' ? 'Funded' : 'Unfunded'}
                </span>
                <button
                  onClick={() => setDashboardTab('milestone-funds')}
                  className="px-3 py-1.5 border border-[#D9E0E8] hover:bg-slate-50 text-slate-700 font-semibold text-xs rounded transition-all cursor-pointer"
                >
                  Inspect
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
