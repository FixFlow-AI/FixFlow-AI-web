import { useState } from "react";
import {
  GitBranch,
  ShieldCheck,
  GitCommit,
  FileCode,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

const mockProofs = [
  {
    id: "req1",
    title: "Idempotent Webhook Processing",
    confidence: 96,
    status: "High",
    desc: "Processing incoming webhook payloads exactly once to avoid double-charging billing profiles.",
    repo: "github.com/freelancer/razorpay-webhooks-node",
    commitHash: "8f0a23d",
    commitMsg:
      "impl: cache webhook signature and hash matching for 24h replay protection",
    rationale:
      "The developer has pushed production code that implements a Redis-backed deduplication sliding window matching this requirement.",
  },
  {
    id: "req2",
    title: "Polygon Smart Contract Interaction",
    confidence: 91,
    status: "High",
    desc: "Connecting Ethers.js provider and calling safe transfer functions on Polygon USDC ERC-20 contract.",
    repo: "github.com/freelancer/polygon-escrow-solidity",
    commitHash: "c4e9912",
    commitMsg:
      "feat: add virtual routing destination split path mapping to Polygon gateway",
    rationale:
      "Direct evidence found in repository containing smart contracts deployed on Polygon Amoy. Audit stamp verified.",
  },
  {
    id: "req3",
    title: "Subscription Event Reconciliation",
    confidence: 68,
    status: "Moderate",
    desc: "Matching legacy Stripe billing timelines with the new virtual account transaction histories.",
    repo: "github.com/freelancer/stripe-migration-tools",
    commitHash: "3a5f782",
    commitMsg: "docs: outline data mapping reconciliation spreadsheet schemas",
    rationale:
      "Documentation evidence exists in the repository, but actual transactional execution script tests are missing.",
  },
];

export function EvidenceConfidence() {
  const [selectedReq, setSelectedReq] = useState(mockProofs[0]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Subsystem 02
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <GitBranch className="text-[#2563EB]" /> Evidence and Confidence Map
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Compare candidate capability based on verified repository history
          rather than profile bidding pitches.
        </p>
      </div>

      {/* Grid: Requirements List vs Proof Graph inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Requirements list */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg space-y-4 lg:col-span-1">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2">
            Parsed Requirements
          </div>

          <div className="space-y-3">
            {mockProofs.map((req) => (
              <button
                key={req.id}
                type="button"
                onClick={() => setSelectedReq(req)}
                className={`w-full text-left p-4 border rounded transition-all flex flex-col justify-between cursor-pointer ${
                  selectedReq.id === req.id
                    ? "border-[#2563EB] bg-[#EDF4FF] ring-1 ring-[#2563EB]"
                    : "border-[#D9E0E8] bg-white hover:border-slate-400"
                }`}
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-800 text-xs leading-normal">
                    {req.title}
                  </h4>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                      req.status === "High"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-yellow-50 border-yellow-200 text-yellow-800"
                    }`}
                  >
                    {req.confidence}%
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">
                  {req.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Right Side: Graph Inspector */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg lg:col-span-2 space-y-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2 flex items-center justify-between">
            <span>Evidence Proof Graph</span>
            <span className="text-xs text-slate-400 font-semibold">
              {selectedReq.title}
            </span>
          </div>

          {/* Interactive Graph Box */}
          <div className="relative border border-[#D9E0E8] rounded bg-[#F7F8FA] p-6 h-60 flex items-center justify-between overflow-hidden">
            {/* Grid Mask */}
            <div className="absolute inset-0 opacity-[0.15] bg-grid-pattern pointer-events-none" />

            {/* Requirement Node */}
            <div className="z-10 bg-white border-2 border-blue-500 rounded p-3 text-center shadow-sm w-44">
              <span className="text-[10px] font-bold text-blue-600 block uppercase tracking-wider">
                Requirement
              </span>
              <span className="text-xs font-bold text-slate-900 line-clamp-1 mt-1">
                {selectedReq.title}
              </span>
            </div>

            {/* Connector Line with active color */}
            <div className="flex-1 h-0.5 relative mx-4">
              <div className="absolute inset-0 bg-blue-500" />
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white border border-blue-200 rounded-full px-2 py-0.5 text-[9px] font-bold text-[#2563EB] shadow-sm">
                Matches {selectedReq.confidence}%
              </div>
            </div>

            {/* Evidence Node */}
            <div className="z-10 bg-white border-2 border-emerald-500 rounded p-3 text-center shadow-sm w-44">
              <span className="text-[10px] font-bold text-emerald-600 block uppercase tracking-wider flex items-center justify-center gap-1">
                <CheckCircle size={10} /> GitHub Proof
              </span>
              <span className="text-xs font-bold text-slate-900 line-clamp-1 mt-1">
                {selectedReq.commitHash}
              </span>
            </div>
          </div>

          {/* Rationale and Details */}
          <div className="space-y-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                Requirement Target
              </span>
              <p className="text-sm text-slate-700">{selectedReq.desc}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#D9E0E8]">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                  <FileCode size={14} className="text-slate-400" /> Repository
                  Source
                </span>
                <a
                  href={`https://${selectedReq.repo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1"
                >
                  {selectedReq.repo} <ExternalLink size={12} />
                </a>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                  <GitCommit size={14} className="text-slate-400" /> Verifiable
                  Commit
                </span>
                <span className="text-xs font-mono text-slate-600 block">
                  [{selectedReq.commitHash}] {selectedReq.commitMsg}
                </span>
              </div>
            </div>

            <div className="space-y-1 bg-slate-50 p-4 border border-slate-100 rounded">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1">
                <ShieldCheck size={14} className="text-emerald-500" /> Vetting
                Recommendation
              </span>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                {selectedReq.rationale}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
