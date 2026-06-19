import React, { useState } from 'react';
import useApp from '../../store/index.js';
import api, { FeeBreakdown } from '../../lib/api.js';
import Card from '../../components/ui/Card.js';
import Button from '../../components/ui/Button.js';
import { Lock, Coins, ShieldAlert, Key, History, ShieldCheck, Check } from 'lucide-react';

export const Escrow: React.FC = () => {
  const { escrows, transitionEscrowMilestone, user } = useApp();
  const [selectedEscrowId, setSelectedEscrowId] = useState<string>(escrows[0]?.id || '');
  
  const [mfaTokenInput, setMfaTokenInput] = useState('');
  const [activeMfaMilestoneId, setActiveMfaMilestoneId] = useState<string | null>(null);
  const [mfaError, setMfaError] = useState('');
  
  const [feeBreakdown, setFeeBreakdown] = useState<FeeBreakdown | null>(null);
  const [calculatingMsId, setCalculatingMsId] = useState<string | null>(null);

  const activeEscrow = escrows.find((e) => e.id === selectedEscrowId);

  const handleMilestoneAction = (milestoneId: string, targetState: any) => {
    if (!activeEscrow) return;

    if (targetState === 'Approved' || targetState === 'Funds_Released') {
      // Prompt MFA Step-up TOTP verification
      setActiveMfaMilestoneId(milestoneId);
      setMfaTokenInput('');
      setMfaError('');
    } else {
      transitionEscrowMilestone(activeEscrow.id, milestoneId, targetState, 'System');
    }
  };

  const handleVerifyMfa = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeEscrow || !activeMfaMilestoneId) return;

    try {
      transitionEscrowMilestone(
        activeEscrow.id,
        activeMfaMilestoneId,
        'Funds_Released',
        'Client',
        mfaTokenInput
      );
      // Success
      setActiveMfaMilestoneId(null);
      setMfaTokenInput('');
      setMfaError('');
    } catch (err: any) {
      if (err.message === 'MFA_REQUIRED') {
        setMfaError('Step-up verification token required.');
      } else if (err.message === 'MFA_INVALID') {
        setMfaError('Invalid TOTP verification code. Access Denied.');
      } else {
        setMfaError(err.message);
      }
    }
  };

  const handleCalculateFee = async (milestoneId: string, amount: number) => {
    setCalculatingMsId(milestoneId);
    try {
      const plan = user ? user.selectedPlan : 'FREE';
      const result = await api.calculateFees(amount, plan, 'IN');
      setFeeBreakdown(result);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white">Escrow Operations</h1>
        <p className="text-xs text-slate-400">Verifying secure milestone deposits, payments, and cryptographically signed payouts.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column: Escrows List */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1">Active Contracts</h2>
          <div className="space-y-2">
            {escrows.map((e) => (
              <div
                key={e.id}
                onClick={() => {
                  setSelectedEscrowId(e.id);
                  setFeeBreakdown(null);
                  setCalculatingMsId(null);
                  setActiveMfaMilestoneId(null);
                }}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-colors ${
                  selectedEscrowId === e.id
                    ? 'bg-slate-900 border-blue-500/50 shadow-md shadow-blue-500/5'
                    : 'bg-slate-900/35 border-slate-900 hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3 mb-2 text-slate-200">
                  <Lock className="w-5 h-5 text-blue-500" />
                  <p className="text-xs font-bold font-outfit truncate">Escrow: {e.id}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-550 pt-2 border-t border-slate-950">
                  <span>Chain: {e.chain}</span>
                  <span className="font-bold text-slate-300">${e.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Escrow Milestone details & audit trail */}
        <div className="lg:col-span-2 space-y-6">
          {activeEscrow ? (
            <>
              {/* Milestones Management */}
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-950 pb-4">
                  <div>
                    <h2 className="text-sm font-bold font-outfit text-white">Milestones Checklist</h2>
                    <p className="text-[10px] text-slate-500">Virtual Payout: {activeEscrow.razorpayPaymentId}</p>
                  </div>
                  <div className="text-xs px-2.5 py-1 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded font-medium flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Prisma OCC Guard Active</span>
                  </div>
                </div>

                {/* Milestones list */}
                <div className="space-y-3">
                  {activeEscrow.milestones.map((ms) => (
                    <div key={ms.id} className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-slate-200">{ms.title}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] border font-semibold ${
                              ms.state === 'Funds_Released'
                                ? 'bg-emerald-950/40 border-emerald-900/30 text-emerald-400'
                                : ms.state === 'Active'
                                ? 'bg-blue-950/40 border-blue-900/30 text-blue-400'
                                : 'bg-slate-900 border-slate-800 text-slate-400'
                            }`}>
                              {ms.state}
                            </span>
                          </div>
                          <p className="text-[9px] text-slate-500">Version: {ms.version} // Hash link: {ms.lastAuditHash.substring(0, 16)}...</p>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className="text-right mr-2">
                            <span className="text-xs font-bold text-slate-300">${ms.amount.toLocaleString()}</span>
                            <p className="text-[9px] text-slate-500 uppercase tracking-widest">{ms.percentage}%</p>
                          </div>
                          
                          {/* Calculate fees click */}
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleCalculateFee(ms.id, ms.amount)}
                            className="text-xs text-slate-500 hover:text-slate-200"
                          >
                            <Coins className="w-3.5 h-3.5" />
                          </Button>

                          {/* Transitions */}
                          {ms.state === 'Draft' && (
                            <Button size="sm" onClick={() => handleMilestoneAction(ms.id, 'Pending_Deposit')} className="text-xs py-1 px-2.5">
                              Fund Milestone
                            </Button>
                          )}
                          {ms.state === 'Pending_Deposit' && (
                            <Button size="sm" onClick={() => handleMilestoneAction(ms.id, 'Active')} className="text-xs py-1 px-2.5">
                              Start Work
                            </Button>
                          )}
                          {ms.state === 'Active' && (
                            <Button size="sm" variant="success" onClick={() => handleMilestoneAction(ms.id, 'Approved')} className="text-xs py-1 px-2.5">
                              Approve
                            </Button>
                          )}
                          {ms.state === 'Funds_Released' && (
                            <div className="p-1 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded-full">
                              <Check className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Fee Breakdown Card nested inside milestone */}
                      {feeBreakdown && calculatingMsId === ms.id && (
                        <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-[10px] text-slate-400">
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-slate-500">Gross Amount</p>
                            <p className="font-semibold text-slate-300">${feeBreakdown.grossAmount}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-slate-500">Platform Fee</p>
                            <p className="font-semibold text-slate-300">${feeBreakdown.platformFee}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-slate-500">Razorpay Fee</p>
                            <p className="font-semibold text-slate-300">${feeBreakdown.paymentGatewayFee}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-slate-500">India TDS (1%)</p>
                            <p className="font-semibold text-slate-300">${feeBreakdown.withholdingTax}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-slate-500">Net Payout</p>
                            <p className="font-bold text-emerald-400">${feeBreakdown.netFreelancerEarnings}</p>
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-wider text-slate-500">Client Checkout</p>
                            <p className="font-semibold text-blue-400">${feeBreakdown.totalClientCheckout}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* MFA Modal-like verifier hook */}
              {activeMfaMilestoneId && (
                <Card className="border-amber-950/30 bg-amber-950/5 space-y-4">
                  <div className="flex items-center space-x-2 text-amber-400 border-b border-amber-950/30 pb-3">
                    <ShieldAlert className="w-5 h-5" />
                    <h3 className="text-sm font-bold font-outfit">MFA Verification Required</h3>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    This milestone release requires Multi-Factor Authentication. Please enter the active TOTP verification code below (Use test code <span className="font-bold text-amber-400 font-mono">981242</span>).
                  </p>

                  <form onSubmit={handleVerifyMfa} className="flex flex-col sm:flex-row gap-2 max-w-sm">
                    <div className="relative flex-grow">
                      <Key className="absolute left-3 top-3 w-4.5 h-4.5 text-slate-500" />
                      <input
                        type="text"
                        value={mfaTokenInput}
                        onChange={(e) => setMfaTokenInput(e.target.value)}
                        placeholder="E.g., 981242"
                        required
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <Button type="submit" variant="primary" className="py-2 px-4 gap-1 border-amber-900/40 bg-amber-600 hover:bg-amber-500">
                      Verify & Release
                    </Button>
                  </form>

                  {mfaError && (
                    <p className="text-xs text-red-400 font-semibold">{mfaError}</p>
                  )}
                </Card>
              )}

              {/* Cryptographic Ledger Explorer */}
              <Card className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-950 pb-3">
                  <History className="w-4.5 h-4.5 text-blue-500" />
                  <h3 className="text-sm font-bold font-outfit text-white">Chained Block Audit Trail</h3>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto font-mono text-[10px] text-slate-400">
                  {activeEscrow.auditTrail.map((block) => (
                    <div key={block.index} className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg space-y-1">
                      <div className="flex justify-between text-slate-500 text-[9px] border-b border-slate-900 pb-1 mb-1">
                        <span>Block Index: #{block.index}</span>
                        <span>{new Date(block.timestamp).toLocaleString()}</span>
                      </div>
                      <p><span className="text-blue-500">Event:</span> {block.metadata}</p>
                      <p className="truncate"><span className="text-slate-500">Prev Hash:</span> {block.previousHash}</p>
                      <p className="truncate"><span className="text-slate-500">Block Hash:</span> {block.hash}</p>
                      <div className="flex justify-between text-[9px] text-slate-500 pt-1">
                        <span>Milestone: {block.milestoneId}</span>
                        <span>Role: {block.triggerUserRole}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 border border-dashed border-slate-900 rounded-xl text-xs text-slate-500">
              Select an escrow contract to view milestones.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Escrow;
