import { useState } from 'react'
import { useLandingStore } from '../../store/useLandingStore'
import { Coins, ShieldCheck, CreditCard, RefreshCw, Key } from 'lucide-react'

// Extra Module 1: Earnings Calculator Formula
function calculateEarningsBreakdown(grossAmount: number, plan: 'FREE' | 'SOLO' | 'PRO' | 'AGENCY') {
  const platformRates = { FREE: 0.10, SOLO: 0.05, PRO: 0.03, AGENCY: 0.02 }
  const platformRate = platformRates[plan] || 0.10
  const platformFee = grossAmount * platformRate

  const gatewayRate = 0.02
  const gatewayFixed = 3.0
  const paymentGatewayFee = grossAmount * gatewayRate + gatewayFixed

  const withholdingTax = grossAmount * 0.01 // 1% TDS India
  const clientProcessingFee = grossAmount * 0.015

  const netFreelancerEarnings = grossAmount - platformFee - paymentGatewayFee - withholdingTax
  const totalClientCheckout = grossAmount + clientProcessingFee

  return {
    grossAmount,
    platformFee,
    paymentGatewayFee,
    withholdingTax,
    netFreelancerEarnings: parseFloat(netFreelancerEarnings.toFixed(2)),
    totalClientCheckout: parseFloat(totalClientCheckout.toFixed(2)),
  }
}

export function MilestoneFunds() {
  const {
    milestones,
    fundMilestone,
    releaseMilestone,
    isAgreementSigned,
  } = useLandingStore()

  const [selectedMilestoneId, setSelectedMilestoneId] = useState('m1')
  const [fundingLoading, setFundingLoading] = useState(false)
  const [releaseLoading, setReleaseLoading] = useState(false)
  const [showMfaInput, setShowMfaInput] = useState(false)
  const [mfaToken, setMfaToken] = useState('')
  const [mfaError, setMfaError] = useState('')

  const activeMilestone = milestones.find((m) => m.id === selectedMilestoneId)
  const bothSigned = isAgreementSigned.client && isAgreementSigned.freelancer

  // Calculate fee breakdown for selected milestone
  const gross = activeMilestone ? activeMilestone.amount : 0
  const plan: 'FREE' | 'SOLO' | 'PRO' | 'AGENCY' = 'PRO' // Mocking PRO plan tier
  const breakdown = calculateEarningsBreakdown(gross, plan)

  const handleFund = () => {
    if (!activeMilestone) return
    setFundingLoading(true)
    setTimeout(() => {
      setFundingLoading(false)
      fundMilestone(activeMilestone.id)
    }, 1000)
  }

  const handleReleaseTrigger = () => {
    setShowMfaInput(true)
    setMfaToken('')
    setMfaError('')
  }

  const handleMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mfaToken !== '123456') {
      setMfaError('Invalid MFA token. Enter 123456 to pass security check.')
      return
    }
    setReleaseLoading(true)
    setShowMfaInput(false)
    setTimeout(() => {
      setReleaseLoading(false)
      if (activeMilestone) {
        releaseMilestone(activeMilestone.id)
      }
    }, 1000)
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Subsystem 06</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Coins className="text-[#2563EB]" /> Protected Milestone Funds
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Lock deposits in secure multi-sig escrows, review transparent fee splits, and authorize releases safely.
        </p>
      </div>

      {!bothSigned ? (
        <div className="p-8 border border-orange-200 bg-orange-50 rounded-lg text-center max-w-lg mx-auto space-y-4">
          <Coins size={36} className="text-orange-500 mx-auto animate-pulse" />
          <h3 className="text-lg font-bold text-slate-900">Escrow Vault Locked</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            The escrow ledger cannot process fund routing until both the Client and Freelancer sign the Working Agreement.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left panel: Milestone selectors */}
          <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg space-y-4 lg:col-span-1">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2">
              Milestone Escrows
            </div>

            <div className="space-y-3">
              {milestones.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSelectedMilestoneId(m.id)
                    setShowMfaInput(false)
                  }}
                  className={`w-full text-left p-4 border rounded transition-all flex flex-col justify-between cursor-pointer ${
                    selectedMilestoneId === m.id
                      ? 'border-[#2563EB] bg-[#EDF4FF] ring-1 ring-[#2563EB]'
                      : 'border-[#D9E0E8] bg-white hover:border-slate-400'
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="font-bold text-slate-800 text-xs leading-normal">{m.title}</span>
                  </div>
                  <div className="flex justify-between items-center mt-3 w-full">
                    <span className="font-bold text-slate-900 font-mono text-xs">${m.amount.toLocaleString()} USDC</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border capitalize ${
                        m.status === 'released'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                          : m.status === 'funded'
                          ? 'bg-blue-50 border-blue-200 text-blue-700'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right Panel: Transaction details and calculators */}
          <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg lg:col-span-2 space-y-6">
            {activeMilestone && (
              <>
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2 flex justify-between">
                  <span>Vault Details</span>
                  <span className="text-[#2563EB]">{activeMilestone.title}</span>
                </div>

                {/* Escrow State Transition Console */}
                <div className="p-5 border border-[#D9E0E8] rounded bg-[#F7F8FA] flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Escrow FSM Transition</span>
                    <p className="text-xs text-slate-600">
                      Current state: <strong className="text-slate-900 uppercase font-mono">{activeMilestone.status}</strong>
                    </p>
                  </div>

                  <div className="flex gap-2">
                    {activeMilestone.status === 'unfunded' ? (
                      <button
                        onClick={handleFund}
                        disabled={fundingLoading}
                        className="px-4 py-2 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {fundingLoading ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Transferring...
                          </>
                        ) : (
                          <>
                            <CreditCard size={14} /> Deposit Milestone Funds
                          </>
                        )}
                      </button>
                    ) : activeMilestone.status === 'funded' ? (
                      <button
                        onClick={handleReleaseTrigger}
                        disabled={releaseLoading}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {releaseLoading ? (
                          <>
                            <RefreshCw size={14} className="animate-spin" /> Releasing...
                          </>
                        ) : (
                          <>
                            <ShieldCheck size={14} /> Verify & Release Payout
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="text-emerald-600 font-bold text-xs flex items-center gap-1">
                        <ShieldCheck size={16} /> Funds Released to Ledger
                      </div>
                    )}
                  </div>
                </div>

                {/* MFA Verification Panel */}
                {showMfaInput && (
                  <form onSubmit={handleMfaSubmit} className="p-4 border border-blue-200 bg-[#EDF4FF] rounded text-xs space-y-3 animate-slideDown">
                    <div className="flex items-center gap-1.5 font-bold text-[#2563EB] uppercase tracking-wider">
                      <Key size={14} /> Secure release verification (TOTP)
                    </div>
                    <p className="text-slate-600">
                      Enter the 6-digit verification code sent to your authenticator app to authorize smart-contract release.
                      For prototype walkthrough, input <strong className="text-slate-900">123456</strong>.
                    </p>
                    {mfaError && <p className="text-[#C2410C] font-semibold">{mfaError}</p>}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="••••••"
                        value={mfaToken}
                        onChange={(e) => setMfaToken(e.target.value)}
                        className="p-2 border border-[#D9E0E8] bg-white rounded text-center w-24 tracking-widest font-mono text-sm focus:outline-none focus:border-[#2563EB]"
                        maxLength={6}
                        required
                      />
                      <button
                        type="submit"
                        className="px-4 py-2 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-xs rounded cursor-pointer"
                      >
                        Confirm Release
                      </button>
                    </div>
                  </form>
                )}

                {/* Transparent Earnings Calculator Breakdown */}
                <div className="space-y-4 pt-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Transparent Earnings breakdown
                  </span>

                  <div className="border border-[#D9E0E8] rounded divide-y divide-[#D9E0E8] font-mono text-[11px] text-slate-600">
                    <div className="p-2.5 flex justify-between">
                      <span>Gross Scoped Value</span>
                      <span className="font-bold text-slate-900">${breakdown.grossAmount.toLocaleString()} USDC</span>
                    </div>

                    <div className="p-2.5 flex justify-between bg-slate-50">
                      <span>Platform Commission ({plan === 'PRO' ? '3%' : '5%'} cut)</span>
                      <span className="text-[#C2410C] font-semibold">-${breakdown.platformFee.toLocaleString()} USDC</span>
                    </div>

                    <div className="p-2.5 flex justify-between">
                      <span>Razorpay Payment Gateway Fee (2% + $3)</span>
                      <span className="text-[#C2410C] font-semibold">-${breakdown.paymentGatewayFee.toLocaleString()} USDC</span>
                    </div>

                    <div className="p-2.5 flex justify-between bg-slate-50">
                      <span>Withholding Tax (1% TDS India)</span>
                      <span className="text-[#C2410C] font-semibold">-${breakdown.withholdingTax.toLocaleString()} USDC</span>
                    </div>

                    <div className="p-2.5 flex justify-between font-sans font-bold text-emerald-700 text-xs bg-emerald-50">
                      <span>Net Freelancer Payout</span>
                      <span>${breakdown.netFreelancerEarnings.toLocaleString()} USDC</span>
                    </div>

                    <div className="p-2.5 flex justify-between font-sans font-bold text-slate-700 text-xs">
                      <span>Total Client Checkout (with 1.5% premium)</span>
                      <span>${breakdown.totalClientCheckout.toLocaleString()} USDC</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
