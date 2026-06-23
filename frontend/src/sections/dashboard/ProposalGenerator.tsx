import { useState } from 'react'
import { useLandingStore } from '../../store/useLandingStore'
import { Cpu, Sparkles, RefreshCw, CheckCircle, FileSignature } from 'lucide-react'

export function ProposalGenerator() {
  const {
    rawBriefText,
    isProposalGenerated,
    generatedProposal,
    setGeneratedProposal,
    setProposalGenerated,
    setDashboardTab,
  } = useLandingStore()

  const [generating, setGenerating] = useState(false)
  const [streamProgress, setStreamProgress] = useState('')

  const handleGenerate = () => {
    setGenerating(true)
    setStreamProgress('')

    const sections = [
      '# PROJECT PROPOSAL: Northstar Billing Migration\n\n',
      '## 1. Project Summary\nThis proposal establishes a secure payment workflow to replace the legacy Stripe pipeline with Razorpay, backed by a secondary Web3 escrow path using USDC on Polygon.\n\n',
      '## 2. Technical Architecture\n- **Backend**: Express + Redis deduplication webhooks.\n- **Web3**: Polygon ERC-20 Escrow contract calls.\n- **Database**: PostgreSQL transactional ledger updates via Prisma.\n\n',
      '## 3. Milestones & Escrow Release Rules\n- **Milestone 1 ($8,000)**: Database migration plan and validation scripts.\n- **Milestone 2 ($10,500)**: Webhook caches and live payment controllers.\n- **Milestone 3 ($6,000)**: Polygon SBT reputation credential contract deployments.\n\n',
      '## 4. Assumptions & Exclusions\n- Excludes legacy database performance tuning.\n- Client must provide sandbox API credentials.'
    ]

    let currentSectionIdx = 0
    let currentText = ''

    const interval = setInterval(() => {
      if (currentSectionIdx < sections.length) {
        currentText += sections[currentSectionIdx]
        setStreamProgress(currentText)
        currentSectionIdx++
      } else {
        clearInterval(interval)
        setGenerating(false)
        setGeneratedProposal(currentText)
        setProposalGenerated(true)
      }
    }, 450)
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Subsystem 03</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Cpu className="text-[#2563EB]" /> Project Proposal Generator
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Automate proposal creation by compiling requirements and evidence assets into structured draft terms.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar: Inputs */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg lg:col-span-1 space-y-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2">
            Configuration
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-600">Active Brief Context</span>
            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-100 italic line-clamp-4">
              "{rawBriefText}"
            </p>
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-bold text-slate-600">Target Strategy</span>
            <select className="w-full p-2 bg-white border border-[#D9E0E8] rounded text-xs text-slate-800 focus:outline-none focus:border-[#2563EB]">
              <option value="fixed">Fixed-Price Escrow Milestones</option>
              <option value="retained">Retained Iterative Cycles</option>
            </select>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-xs rounded transition-colors disabled:opacity-75 cursor-pointer"
          >
            {generating ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Generating Proposal...
              </>
            ) : isProposalGenerated ? (
              'Regenerate Proposal'
            ) : (
              <>
                <Sparkles size={14} /> Compose Proposal Terms
              </>
            )}
          </button>
        </div>

        {/* Viewport: Generated Proposal */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg lg:col-span-2 space-y-4">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2 flex items-center justify-between">
            <span>Proposal Draft Preview</span>
            {isProposalGenerated && (
              <button
                onClick={() => setDashboardTab('agreement-composer')}
                className="flex items-center gap-1 text-[#2563EB] hover:text-[#173EA5] text-xs font-bold"
              >
                <FileSignature size={14} /> Load into Agreement Composer
              </button>
            )}
          </div>

          {!isProposalGenerated && !generating ? (
            <div className="h-80 flex flex-col items-center justify-center text-slate-400 text-center space-y-2">
              <Cpu size={32} className="stroke-[1.5]" />
              <p className="text-sm">Click "Compose Proposal Terms" to start the streaming compiler.</p>
            </div>
          ) : (
            <div className="border border-[#D9E0E8] rounded bg-[#F7F8FA] p-6 h-[400px] overflow-y-auto font-mono text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
              {generating ? (
                <>
                  {streamProgress}
                  <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-0.5" />
                </>
              ) : (
                generatedProposal
              )}
            </div>
          )}

          {isProposalGenerated && !generating && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#16A34A] rounded text-xs flex items-center gap-2">
              <CheckCircle size={16} /> Ready. Proposal terms are structured. You can load these terms into the working agreement.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
