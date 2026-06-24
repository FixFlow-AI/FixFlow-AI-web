import React, { useState } from "react";
import { useLandingStore } from "../../store/useLandingStore";
import {
  FileText,
  Cpu,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
} from "lucide-react";

export function BriefIntelligence() {
  const { rawBriefText, isBriefParsed, setBriefText, setBriefParsed } =
    useLandingStore();

  const [text, setText] = useState(rawBriefText);
  const [parsing, setParsing] = useState(false);
  const [parsingStep, setParsingStep] = useState(0);

  // Clarification questions answered state
  const [q1Answer, setQ1Answer] = useState("");
  const [q2Answer, setQ2Answer] = useState("");
  const [answersSubmitted, setAnswersSubmitted] = useState(false);

  const handleParse = (e) => {
    e.preventDefault();
    setBriefText(text);
    setParsing(true);
    setParsingStep(1);

    // Simulate multi-stage parsing steps
    setTimeout(() => setParsingStep(2), 600);
    setTimeout(() => setParsingStep(3), 1200);
    setTimeout(() => {
      setParsing(false);
      setBriefParsed(true);
    }, 1800);
  };

  // Preset briefs for quick testing
  const presets = [
    {
      title: "Stripe to Razorpay + Web3 Migration",
      text: "Migrate our payment infrastructure to Razorpay and deploy a secondary Polygon USDC payment pathway. Keep the transition seamless without subscription downtime.",
    },
    {
      title: "Basic Escrow Integration (Ambiguous)",
      text: "Need to add escrow payments to our site. Just make it work quickly.",
    },
  ];

  // Calculate scope stability metric dynamically
  const isAmbiguous = text.length < 100;
  const stabilityScore = isAmbiguous ? 45 : answersSubmitted ? 95 : 72;
  const riskLabel =
    stabilityScore < 50
      ? "HIGH SCOPE CREEP RISK"
      : stabilityScore < 80
        ? "MODERATE RISK"
        : "PREMIUM SCOPE";

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Subsystem 01
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <FileText className="text-[#2563EB]" /> Brief Intelligence Workspace
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Input your raw project briefs to automatically structure deliverables,
          dependencies, and risk scores.
        </p>
      </div>

      {/* Grid: Editor & Output */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input panel */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg space-y-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2">
            Project Brief Editor
          </div>

          {/* Presets */}
          <div className="flex gap-2">
            {presets.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setText(p.text);
                  setBriefParsed(false);
                  setAnswersSubmitted(false);
                }}
                className="px-3 py-1.5 bg-[#F7F8FA] border border-[#D9E0E8] text-slate-700 text-xs font-semibold rounded hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Preset v{idx + 1}
              </button>
            ))}
          </div>

          <form onSubmit={handleParse} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="brief"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
              >
                Raw Requirements Text
              </label>
              <textarea
                id="brief"
                rows={8}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  if (isBriefParsed) setBriefParsed(false);
                }}
                placeholder="Describe your project, deadlines, tech stack, and goals..."
                className="w-full p-4 bg-white border border-[#D9E0E8] rounded focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-sm text-slate-900 transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={parsing}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-sm rounded transition-colors disabled:opacity-75 cursor-pointer"
            >
              {parsing ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  {parsingStep === 1
                    ? "Structuring Ingestion..."
                    : parsingStep === 2
                      ? "Analyzing Technical Gaps..."
                      : "Mapping Risk Scores..."}
                </>
              ) : isBriefParsed ? (
                "Reparse Brief"
              ) : (
                "Parse Project Brief"
              )}
            </button>
          </form>
        </div>

        {/* Output panel */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2 flex items-center justify-between">
            <span>System Output</span>
            {isBriefParsed && (
              <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold uppercase">
                <CheckCircle size={14} /> Synced
              </span>
            )}
          </div>

          {!isBriefParsed && !parsing ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-center space-y-2">
              <Cpu size={32} className="stroke-[1.5]" />
              <p className="text-sm">
                Click "Parse Project Brief" to run the system scoping parser.
              </p>
            </div>
          ) : parsing ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-center space-y-4">
              <RefreshCw size={36} className="animate-spin text-[#2563EB]" />
              <div className="text-sm space-y-1">
                <p className="font-bold text-slate-800">
                  Autonomous Parser Running
                </p>
                <p className="text-xs text-slate-400">
                  Reviewing grammar, identifying dependencies, and tagging
                  unknowns.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-fadeIn py-2">
              {/* Scope Stability Card */}
              <div className="p-4 border border-[#D9E0E8] rounded bg-[#F7F8FA] flex justify-between items-center">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Scope Stability Rating
                  </span>
                  <div className="text-xl font-extrabold text-slate-900 mt-1">
                    {stabilityScore}%
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Risk Label
                  </span>
                  <div
                    className={`text-xs font-extrabold px-2 py-0.5 border rounded-full mt-1 ${
                      stabilityScore < 50
                        ? "bg-orange-50 border-orange-200 text-[#C2410C]"
                        : stabilityScore < 80
                          ? "bg-yellow-50 border-yellow-200 text-yellow-800"
                          : "bg-emerald-50 border-emerald-200 text-[#16A34A]"
                    }`}
                  >
                    {riskLabel}
                  </div>
                </div>
              </div>

              {/* Parsed Outcomes */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Parsed Outcomes
                </h4>
                <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-4">
                  <li>
                    Configure virtual routing accounts for split-payout mapping.
                  </li>
                  <li>
                    Build a secondary Web3 transaction dispatcher utilizing USDC
                    on Polygon.
                  </li>
                  {isAmbiguous ? (
                    <li className="text-[#C2410C] font-semibold list-none pl-0 mt-1 flex items-center gap-1">
                      <AlertTriangle size={14} /> Gaps found: Describe the
                      subscription system for detailed outcomes.
                    </li>
                  ) : (
                    <>
                      <li>
                        Integrate Stripe-compatible legacy webhooks for backup
                        verification.
                      </li>
                      <li>
                        Deploy automated rollback triggers on sync
                        discrepancies.
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {/* Clarification Gaps */}
              <div className="space-y-3 pt-3 border-t border-[#D9E0E8]">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1 text-orange-600">
                  <AlertTriangle size={14} /> Clarification Gaps (
                  {answersSubmitted ? "0" : "2"} Gaps Open)
                </h4>

                {answersSubmitted ? (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#16A34A] rounded text-xs">
                    All clarifications answered. Scope stability rating
                    upgraded.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="q1"
                        className="block text-xs font-semibold text-slate-600"
                      >
                        1. What is the expected maximum latency for Web3 deposit
                        recognition?
                      </label>
                      <input
                        id="q1"
                        type="text"
                        value={q1Answer}
                        onChange={(e) => setQ1Answer(e.target.value)}
                        placeholder="e.g., Under 15 seconds / within 5 blocks"
                        className="w-full px-3 py-2 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="q2"
                        className="block text-xs font-semibold text-slate-600"
                      >
                        2. Do you require real-time email alerts for customer
                        webhook failures?
                      </label>
                      <input
                        id="q2"
                        type="text"
                        value={q2Answer}
                        onChange={(e) => setQ2Answer(e.target.value)}
                        placeholder="e.g., Yes, send Slack/email alerts"
                        className="w-full px-3 py-2 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB]"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setAnswersSubmitted(true)}
                      className="px-4 py-2 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-xs rounded transition-colors cursor-pointer"
                    >
                      Submit Answers
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
