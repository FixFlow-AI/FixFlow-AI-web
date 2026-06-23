import { useState } from 'react'
import { useLandingStore } from '../../store/useLandingStore'
import { KanbanSquare, GitPullRequest, AlertTriangle, Plus } from 'lucide-react'

export function DeliveryControl() {
  const {
    milestones,
    changeRequests,
    addChangeRequest,
    resolveChangeRequest,
    isAgreementSigned,
  } = useLandingStore()

  // Deliverable inputs
  const [prLink, setPrLink] = useState('')
  const [deliverablesMsg, setDeliverablesMsg] = useState('')
  const [submittedDelivs, setSubmittedDelivs] = useState<Array<{ milestoneId: string; pr: string; msg: string }>>([])

  // Change request inputs
  const [changeTitle, setChangeTitle] = useState('')
  const [changeAmount, setChangeAmount] = useState(2000)
  const [changeTime, setChangeTime] = useState('+4 days')

  const bothSigned = isAgreementSigned.client && isAgreementSigned.freelancer

  // Find active milestone for delivery submission (first funded, non-released milestone)
  const activeMilestone = milestones.find((m) => m.status === 'funded')

  const handleDeliverableSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeMilestone) return
    setSubmittedDelivs([
      ...submittedDelivs,
      { milestoneId: activeMilestone.id, pr: prLink, msg: deliverablesMsg },
    ])
    setPrLink('')
    setDeliverablesMsg('')
  }

  const handleRaiseChange = (e: React.FormEvent) => {
    e.preventDefault()
    if (!changeTitle) return
    addChangeRequest(changeTitle, changeAmount, changeTime)
    setChangeTitle('')
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Subsystem 05</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <KanbanSquare className="text-[#2563EB]" /> Shared Delivery and Change Control
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Submit engineering deliverables directly mapped to milestones, and coordinate scope changes transparently.
        </p>
      </div>

      {!bothSigned ? (
        <div className="p-8 border border-orange-200 bg-orange-50 rounded-lg text-center max-w-lg mx-auto space-y-4">
          <AlertTriangle size={36} className="text-[#C2410C] mx-auto animate-pulse" />
          <h3 className="text-lg font-bold text-slate-900">Delivery Space Locked</h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            The workspace cannot accept submissions or scope changes until both the Client and Freelancer have authorized the Working Agreement terms.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Deliverables submissions */}
          <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg space-y-6">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2 flex items-center gap-1.5">
              <GitPullRequest size={14} className="text-blue-500" /> Deliverables Workspace
            </div>

            {activeMilestone ? (
              <form onSubmit={handleDeliverableSubmit} className="space-y-4 bg-slate-50 p-4 border border-slate-100 rounded">
                <span className="text-[10px] font-bold text-[#2563EB] uppercase tracking-wider block">
                  Active Milestone: {activeMilestone.title}
                </span>

                <div className="space-y-2">
                  <label htmlFor="pr" className="block text-xs font-semibold text-slate-700">GitHub Pull-Request Link</label>
                  <input
                    id="pr"
                    type="text"
                    placeholder="github.com/northstar/reconcile-billing/pull/12"
                    value={prLink}
                    onChange={(e) => setPrLink(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="msg" className="block text-xs font-semibold text-slate-700">Submission Notes</label>
                  <textarea
                    id="msg"
                    rows={3}
                    placeholder="All tests pass. Database migration verification log is attached..."
                    value={deliverablesMsg}
                    onChange={(e) => setDeliverablesMsg(e.target.value)}
                    className="w-full p-3 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB]"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="px-4 py-2 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-xs rounded transition-colors cursor-pointer"
                >
                  Submit Deliverable
                </button>
              </form>
            ) : (
              <div className="p-4 border border-[#D9E0E8] text-center rounded text-xs text-slate-500 bg-[#F7F8FA]">
                No funded milestones require delivery at this time. Go to "Milestone Funds" to deposit capital.
              </div>
            )}

            {/* Submitted Trail */}
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Delivery Audit Trail</span>
              {submittedDelivs.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No deliverables submitted yet.</p>
              ) : (
                <div className="space-y-3">
                  {submittedDelivs.map((d, idx) => {
                    const matchedM = milestones.find((m) => m.id === d.milestoneId)
                    return (
                      <div key={idx} className="p-3 border border-[#D9E0E8] bg-white rounded text-xs space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-800 line-clamp-1">{matchedM?.title}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-800 border border-yellow-200">
                            Pending Review
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600"><strong>PR:</strong> <span className="font-mono text-slate-500">{d.pr}</span></p>
                        <p className="text-[11px] text-slate-500 italic">"{d.msg}"</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: Change Control */}
          <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg space-y-6">
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2 flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-orange-500" /> Change Control Board
            </div>

            {/* Raise Change Form */}
            <form onSubmit={handleRaiseChange} className="space-y-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Propose Scope Change</span>

              <div className="space-y-2">
                <label htmlFor="ctitle" className="block text-xs font-semibold text-slate-700">Change Request Title</label>
                <input
                  id="ctitle"
                  type="text"
                  placeholder="e.g. Integrate secondary SMS notification fallback"
                  value={changeTitle}
                  onChange={(e) => setChangeTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="camount" className="block text-xs font-semibold text-slate-700">Budget Change (USDC)</label>
                  <input
                    id="camount"
                    type="number"
                    value={changeAmount}
                    onChange={(e) => setChangeAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB]"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="ctime" className="block text-xs font-semibold text-slate-700">Timeline Impact</label>
                  <input
                    id="ctime"
                    type="text"
                    placeholder="e.g. +3 days"
                    value={changeTime}
                    onChange={(e) => setChangeTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB]"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-2 bg-[#2563EB] hover:bg-[#173EA5] text-white font-bold text-xs rounded transition-colors cursor-pointer"
              >
                <Plus size={14} /> Propose Scope Extension
              </button>
            </form>

            {/* Change Requests list */}
            <div className="space-y-3 pt-4 border-t border-[#D9E0E8]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Proposals</span>
              {changeRequests.length === 0 ? (
                <p className="text-xs text-slate-400 italic">No scope changes pending.</p>
              ) : (
                <div className="space-y-3">
                  {changeRequests.map((r) => (
                    <div key={r.id} className="p-4 border border-[#D9E0E8] rounded text-xs bg-[#F7F8FA] space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-800">{r.title}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            r.status === 'accepted'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : r.status === 'rejected'
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
                          }`}
                        >
                          {r.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-slate-500 font-mono text-[10px]">
                        <span>Budget: +${r.amountChange.toLocaleString()} USDC</span>
                        <span>Timeline: {r.timeChange}</span>
                      </div>

                      {r.status === 'pending' && (
                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            onClick={() => resolveChangeRequest(r.id, 'rejected')}
                            className="px-2.5 py-1 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-semibold rounded text-[11px] cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => resolveChangeRequest(r.id, 'accepted')}
                            className="px-2.5 py-1 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded text-[11px] cursor-pointer"
                          >
                            Accept & Update
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
