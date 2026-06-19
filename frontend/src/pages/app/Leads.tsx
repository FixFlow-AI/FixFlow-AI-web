import React, { useState } from 'react';
import useApp, { LeadItem } from '../../store/index.js';
import Card from '../../components/ui/Card.js';
import Badge from '../../components/ui/Badge.js';
import Button from '../../components/ui/Button.js';
import { ShieldCheck, FileQuestion } from 'lucide-react';

export const Leads: React.FC = () => {
  const { leads, updateLeadStatus } = useApp();
  const [selectedLeadId, setSelectedLeadId] = useState<string>(leads[0]?.id || '');

  const activeLead = leads.find((l) => l.id === selectedLeadId);

  const handleStatusChange = (leadId: string, status: LeadItem['status']) => {
    updateLeadStatus(leadId, status);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white">Leads Pipeline</h1>
        <p className="text-xs text-slate-400">Verifying client parameters and screening matches before bidding.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Side: Leads Column */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1">Qualified Inbound</h2>
          
          <div className="space-y-3">
            {leads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => setSelectedLeadId(lead.id)}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                  selectedLeadId === lead.id
                    ? 'bg-slate-900 border-blue-500/50 shadow-md shadow-blue-500/5'
                    : 'bg-slate-900/35 border-slate-900 hover:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold font-outfit text-slate-200">{lead.company?.name || 'Inbound Lead'}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Source: {lead.source}</p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-blue-950/40 border border-blue-900/30 text-blue-400 font-bold font-outfit">
                      Score: {lead.score}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3 line-clamp-2">{lead.projectDescription}</p>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-950">
                  <span className="text-xs font-bold text-slate-300">${lead.budget.amount.toLocaleString()}</span>
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-blue-500 bg-blue-950/20 px-2 py-0.5 rounded border border-blue-900/20">
                    {lead.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Lead Details, Vetting & Scoring */}
        <div className="lg:col-span-2">
          {activeLead ? (
            <div className="space-y-6">
              {/* Core Context */}
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-950 pb-4">
                  <div>
                    <h2 className="text-lg font-bold font-outfit text-white">{activeLead.company?.name}</h2>
                    <p className="text-xs text-slate-500">Source Link: <a href={activeLead.sourceUrl || '#'} className="text-blue-500 hover:underline">{activeLead.source} Listing</a></p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleStatusChange(activeLead.id, 'LOST')}
                      className="text-xs py-1.5 px-3"
                    >
                      Reject
                    </Button>
                    <Button
                      size="sm"
                      variant="success"
                      onClick={() => handleStatusChange(activeLead.id, 'WON')}
                      className="text-xs py-1.5 px-3 gap-1"
                    >
                      Win Lead <ShieldCheck className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Project Description</h3>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-900/50">
                    {activeLead.projectDescription}
                  </p>
                </div>

                {/* Client score metrics */}
                {activeLead.company && (
                  <div className="grid sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Scope Stability Rating</span>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-bold text-slate-200 font-outfit">{activeLead.company.stabilityScore}/100</span>
                        {activeLead.company.stabilityScore < 60 && (
                          <Badge label="SCOPE_CREEP_RISK" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">Stability score measures modifications to active contract milestones.</p>
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg space-y-1">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Payment Speed Score</span>
                      <div className="flex items-baseline space-x-2">
                        <span className="text-xl font-bold text-slate-200 font-outfit">{activeLead.company.paymentSpeed}/100</span>
                        {activeLead.company.paymentSpeed >= 90 && (
                          <Badge label="PREMIUM_CLIENT" />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed">Calculated from average hours elapsed to approve deliverables.</p>
                    </div>
                  </div>
                )}
              </Card>

              {/* Vetting Panel */}
              <Card className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-950 pb-3">
                  <FileQuestion className="w-5 h-5 text-blue-500" />
                  <h3 className="text-sm font-bold font-outfit text-white">AI-Generated Screening Questions</h3>
                </div>

                {activeLead.matchDetails && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500 mr-2">Vetting Gaps Detected:</span>
                    {activeLead.matchDetails.skillsMissing.length > 0 ? (
                      activeLead.matchDetails.skillsMissing.map((skill) => (
                        <span key={skill} className="px-2 py-0.5 bg-red-950/40 border border-red-900/40 text-red-400 text-[10px] rounded uppercase font-medium">
                          {skill} Gap
                        </span>
                      ))
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-[10px] rounded uppercase font-medium">
                        Skills Aligned (100% match)
                      </span>
                    )}
                  </div>
                )}

                {activeLead.interviewQuestions && activeLead.interviewQuestions.length > 0 ? (
                  <div className="space-y-4 pt-2">
                    {activeLead.interviewQuestions.map((q, idx) => (
                      <div key={idx} className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg space-y-2">
                        <div className="flex items-start space-x-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-900/10 border border-blue-800/30 text-blue-400 text-[10px] font-bold mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-xs font-semibold text-slate-200">{q.question}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed pl-7"><span className="text-blue-500 font-medium">Rationale:</span> {q.rationale}</p>
                        <div className="pl-7 space-y-1.5 pt-1 border-t border-slate-900">
                          <p className="text-[10px] text-slate-400 leading-relaxed"><span className="text-emerald-500 font-medium">Expected Concepts:</span> {q.expectedKeywords.join(', ')}</p>
                          <p className="text-[10px] text-slate-500 leading-relaxed"><span className="text-slate-400 font-medium">Ideal Answer Summary:</span> {q.idealAnswerSummary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-slate-500">
                    No skills gaps detected. Standard screening applies.
                  </div>
                )}
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 border border-dashed border-slate-900 rounded-xl text-xs text-slate-500">
              Select a lead from the pipeline to review parameters.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Leads;
