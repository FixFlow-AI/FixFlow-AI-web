import React, { useState } from 'react';
import useApp from '../../store/index.js';
import Card from '../../components/ui/Card.js';
import Button from '../../components/ui/Button.js';
import { FolderGit2, Users, Lightbulb, ClipboardCopy } from 'lucide-react';

export const Workspaces: React.FC = () => {
  const { workspaces } = useApp();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(workspaces[0]?.id || '');
  const [copySuccess, setCopySuccess] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === selectedWorkspaceId);

  const handleCopyDraft = () => {
    if (!activeWorkspace?.suggestedExtensions) return;
    navigator.clipboard.writeText(activeWorkspace.suggestedExtensions.extensionOfferDraft);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white">Project Workspaces</h1>
        <p className="text-xs text-slate-400">Collaborative workspaces tracking team deliverable histories and repeat contract extensions.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column: Workspaces List */}
        <div className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 px-1">Active Rooms</h2>
          <div className="space-y-2">
            {workspaces.map((w) => (
              <div
                key={w.id}
                onClick={() => setSelectedWorkspaceId(w.id)}
                className={`p-4 rounded-xl border text-left cursor-pointer transition-colors ${
                  selectedWorkspaceId === w.id
                    ? 'bg-slate-900 border-blue-500/50 shadow-md shadow-blue-500/5'
                    : 'bg-slate-900/35 border-slate-900 hover:border-slate-800'
                }`}
              >
                <div className="flex items-center space-x-3 mb-2">
                  <FolderGit2 className="w-5 h-5 text-blue-500" />
                  <p className="text-xs font-bold font-outfit text-slate-200">{w.name}</p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-550 pt-2 border-t border-slate-950">
                  <span>Subscription: {w.plan}</span>
                  <span>{w.members.length} Members</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right column: Workspace details & extensions */}
        <div className="lg:col-span-2">
          {activeWorkspace ? (
            <div className="space-y-6">
              {/* Workspace Members */}
              <Card className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-950 pb-3">
                  <Users className="w-4.5 h-4.5 text-blue-500" />
                  <h2 className="text-sm font-bold font-outfit text-white">Workspace Members</h2>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  {activeWorkspace.members.map((member, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-blue-900/10 border border-blue-800/30 flex items-center justify-center text-xs font-bold text-blue-500">
                        {member.name.substring(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{member.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Context Contract Extensions */}
              {activeWorkspace.suggestedExtensions && (
                <Card className="space-y-4 border-blue-900/20 bg-gradient-to-b from-slate-900/40 to-slate-950/60">
                  <div className="flex items-center space-x-2 border-b border-slate-950 pb-3">
                    <Lightbulb className="w-4.5 h-4.5 text-yellow-500 animate-pulse" />
                    <h3 className="text-sm font-bold font-outfit text-white">AI-Driven Contract Extensions (Phase 2)</h3>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Strategic Reasoning</span>
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-3 rounded-lg border border-slate-900/40">
                      {activeWorkspace.suggestedExtensions.extensionReasoning}
                    </p>
                  </div>

                  {/* Milestones list */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Suggested Phase 2 Milestones</span>
                    
                    {activeWorkspace.suggestedExtensions.suggestedMilestones.map((ms, idx) => (
                      <div key={idx} className="p-4 bg-slate-950/30 border border-slate-900 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-slate-200">{ms.title}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] border font-semibold ${
                              ms.complexity === 'High' 
                                ? 'bg-red-950/40 border-red-900/30 text-red-400' 
                                : ms.complexity === 'Medium' 
                                ? 'bg-amber-950/40 border-amber-900/30 text-amber-400'
                                : 'bg-emerald-950/40 border-emerald-900/30 text-emerald-400'
                            }`}>
                              {ms.complexity}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">{ms.description}</p>
                          <p className="text-[9px] text-slate-500">Duration Estimate: {ms.estimatedDuration}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-bold text-blue-400">+{ms.estimatedBudgetPct}%</span>
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest">Base Budget</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Proposal Copy message */}
                  <div className="space-y-2 pt-2 border-t border-slate-950">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Extension Offer Draft</span>
                      <Button variant="ghost" size="sm" onClick={handleCopyDraft} className="text-xs py-1 px-2.5 gap-1 text-slate-400 hover:text-slate-200">
                        <ClipboardCopy className="w-3.5 h-3.5" />
                        <span>{copySuccess ? 'Copied!' : 'Copy Offer'}</span>
                      </Button>
                    </div>
                    <p className="text-xs text-slate-400 bg-slate-950/50 p-3 rounded-lg border border-slate-900/80 font-mono whitespace-pre-wrap">
                      {activeWorkspace.suggestedExtensions.extensionOfferDraft}
                    </p>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 border border-dashed border-slate-900 rounded-xl text-xs text-slate-500">
              Select an active room workspace to view.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Workspaces;
