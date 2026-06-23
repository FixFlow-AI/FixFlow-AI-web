import { useState } from 'react'
import { useLandingStore } from '../../store/useLandingStore'
import { Award, CheckCircle, RefreshCw, Layers, ExternalLink } from 'lucide-react'

export function OutcomeEvidence() {
  const { milestones } = useLandingStore()

  const [minting, setMinting] = useState(false)
  const [mintStep, setMintStep] = useState(0)
  const [isMinted, setIsMinted] = useState(false)

  // Calculate completed statistics
  const totalCount = milestones.length
  const releasedCount = milestones.filter((m) => m.status === 'released').length
  const allReleased = releasedCount === totalCount

  const handleMint = () => {
    setMinting(true)
    setMintStep(1)

    setTimeout(() => setMintStep(2), 700)
    setTimeout(() => setMintStep(3), 1400)
    setTimeout(() => {
      setMinting(false)
      setIsMinted(true)
    }, 2100)
  }

  // SBT Trait Metadata JSON Preview
  const sbtMetadata = {
    name: 'FixFlow AI Verifiable Reputation SBT',
    description: 'Verification of performance milestones and trust indicators for the DID profile.',
    image: 'ipfs://QmReputationBadgeHash_NorthstarMigration',
    attributes: [
      { trait_type: 'OnTimeRate', value: 100.0 },
      { trait_type: 'RevisionEfficiency', value: 92.5 },
      { trait_type: 'RepeatClientRate', value: 33.3 },
      { trait_type: 'DisputeFreeRate', value: 100.0 },
      { trait_type: 'VerificationStandard', value: 'FixFlow AI Consensus Engine v1' },
    ],
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Subsystem 07</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Award className="text-[#2563EB]" /> Outcome Evidence and Reputation Trail
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Lock completed project metrics into immutable Soulbound Tokens to build a portable reputation portfolio.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left: Summary cards */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg lg:col-span-1 space-y-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2">
            Outcome Analytics
          </div>

          <div className="space-y-4">
            <div className="p-4 border border-[#D9E0E8] rounded bg-[#F7F8FA] flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Milestone Progress</span>
                <div className="text-lg font-bold text-slate-900 mt-1">
                  {releasedCount} / {totalCount} Cleared
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {Math.round((releasedCount / totalCount) * 100)}% Complete
              </span>
            </div>

            <div className="p-4 border border-[#D9E0E8] rounded bg-[#F7F8FA] flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">On-Time delivery rate</span>
                <div className="text-lg font-bold text-slate-900 mt-1">100%</div>
              </div>
              <span className="text-xs text-emerald-600 font-bold">Premium</span>
            </div>

            <div className="p-4 border border-[#D9E0E8] rounded bg-[#F7F8FA] flex justify-between items-center">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dispute-Free Rate</span>
                <div className="text-lg font-bold text-slate-900 mt-1">100%</div>
              </div>
              <span className="text-xs text-emerald-600 font-bold">Consensus</span>
            </div>
          </div>
        </div>

        {/* Right: SBT Minting Portal */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg lg:col-span-2 space-y-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2">
            Polygon DID Reputation SBT Minting
          </div>

          {!allReleased ? (
            <div className="p-6 border border-orange-200 bg-orange-50 rounded text-center space-y-3">
              <Layers size={32} className="text-orange-500 mx-auto" />
              <h4 className="font-bold text-slate-900 text-sm">Escrow Milestones Open</h4>
              <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                You can only mint the reputation SBT credential when all scoped milestones are successfully completed, approved, and released.
                Currently, {releasedCount} of {totalCount} milestones are released.
              </p>
            </div>
          ) : !isMinted && !minting ? (
            <div className="space-y-4 text-center py-6">
              <Layers size={44} className="text-[#2563EB] mx-auto animate-bounce" />
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-sm">Reputation SBT Eligible</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  All milestones are completed. Mint your portable performance SBT to Polygon blockchain to record this work history on-chain.
                </p>
              </div>
              <button
                onClick={handleMint}
                className="px-6 py-2.5 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-xs rounded transition-colors cursor-pointer"
              >
                Mint Reputation SBT
              </button>
            </div>
          ) : minting ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center space-y-4">
              <RefreshCw size={36} className="animate-spin text-[#2563EB]" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-slate-800">
                  {mintStep === 1
                    ? '1/3 Compiling SBT Metadata...'
                    : mintStep === 2
                    ? '2/3 Signing wallet transaction...'
                    : '3/3 Broadcasting to Polygon block ledger...'}
                </p>
                <p className="text-slate-400">Please do not refresh the browser or disconnect your wallet provider.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded flex gap-3">
                <CheckCircle size={20} className="shrink-0 mt-0.5 text-emerald-600" />
                <div className="text-xs space-y-1">
                  <span className="font-bold block">Soulbound DID Minted Successfully</span>
                  <p>Transaction hash: <span className="font-mono font-semibold">0x4ae8...392fc</span></p>
                  <a
                    href="https://polygonscan.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#2563EB] hover:underline mt-1"
                  >
                    View on Polygonscan <ExternalLink size={12} />
                  </a>
                </div>
              </div>

              {/* SBT Metadata Preview */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">SBT Token Metadata Schema</span>
                <div className="border border-[#D9E0E8] bg-[#F7F8FA] rounded p-4 font-mono text-[10px] text-slate-700 h-44 overflow-y-auto whitespace-pre-wrap">
                  {JSON.stringify(sbtMetadata, null, 2)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
