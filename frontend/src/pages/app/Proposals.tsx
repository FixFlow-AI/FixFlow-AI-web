import React, { useState } from 'react';
import useApp from '../../store/index.js';
import api from '../../lib/api.js';
import Card from '../../components/ui/Card.js';
import Button from '../../components/ui/Button.js';
import { 
  FileText, 
  Send, 
  Share2, 
  MessageSquare, 
  ChevronRight, 
  Play, 
  Loader2
} from 'lucide-react';

export const Proposals: React.FC = () => {
  const { proposals, addProposal, addProposalComment } = useApp();
  const [selectedProposalId, setSelectedProposalId] = useState<string>(proposals[0]?.id || '');
  
  const [briefInput, setBriefInput] = useState('');
  const [generating, setGenerating] = useState(false);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [commentText, setCommentText] = useState('');
  const [sharePortalUrl, setSharePortalUrl] = useState('');

  const activeProposal = proposals.find((p) => p.id === selectedProposalId);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!briefInput.trim()) return;

    setGenerating(true);
    setStreamLog([]);
    setSharePortalUrl('');

    try {
      const newProposal = await api.generateProposal(briefInput, (chunk) => {
        setStreamLog((prev) => [...prev, chunk]);
      });
      addProposal(newProposal);
      setSelectedProposalId(newProposal.id);
      setBriefInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setGenerating(false);
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activeProposal) return;
    addProposalComment(activeProposal.id, commentText);
    setCommentText('');
  };

  const handleCreatePortal = () => {
    if (!activeProposal) return;
    setSharePortalUrl(`https://fixflowai.com/portals/ptl_${activeProposal.id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white">Proposal Builder</h1>
        <p className="text-xs text-slate-400">Streamlining briefs into structured milestone proposals and client portals.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Side: Create & List */}
        <div className="space-y-6">
          {/* Create Proposal */}
          <Card className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Decompose New Brief</h2>
            <form onSubmit={handleGenerate} className="space-y-3">
              <textarea
                value={briefInput}
                onChange={(e) => setBriefInput(e.target.value)}
                placeholder="E.g., Build a multiplayer TicTacToe game in React with room syncing..."
                rows={4}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
              />
              <Button type="submit" fullWidth disabled={generating} className="gap-1.5 py-2">
                {generating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Stream Decomposing...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> Analyze Brief
                  </>
                )}
              </Button>
            </form>

            {generating && (
              <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg max-h-32 overflow-y-auto space-y-1 font-mono text-[9px] text-blue-400">
                {streamLog.map((log, idx) => (
                  <p key={idx} className="flex items-center space-x-1.5">
                    <ChevronRight className="w-3 h-3 text-slate-600" />
                    <span>{log}</span>
                  </p>
                ))}
              </div>
            )}
          </Card>

          {/* Proposals List */}
          <Card className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Workspace Proposals</h2>
            <div className="space-y-2">
              {proposals.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProposalId(p.id);
                    setSharePortalUrl('');
                  }}
                  className={`p-3 rounded-lg border text-left cursor-pointer transition-colors ${
                    selectedProposalId === p.id
                      ? 'bg-slate-900 border-blue-500/50'
                      : 'bg-slate-900/30 border-slate-900 hover:border-slate-850'
                  }`}
                >
                  <p className="text-xs font-semibold text-slate-200 truncate">{p.title}</p>
                  <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
                    <span>v{p.versionCount} Draft</span>
                    <span className="text-emerald-400">Ready</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Side: Proposal Details */}
        <div className="lg:col-span-2">
          {activeProposal ? (
            <div className="space-y-6">
              {/* Proposal Document details */}
              <Card className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-950 pb-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <div>
                      <h2 className="text-sm font-bold font-outfit text-white">{activeProposal.title}</h2>
                      <p className="text-[10px] text-slate-500 font-mono">S3 Location: {activeProposal.s3Key}</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleCreatePortal} className="text-xs py-1.5 px-3 gap-1.5">
                    <Share2 className="w-3.5 h-3.5" /> Share Portal
                  </Button>
                </div>

                {/* Score details */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: 'Scope Alignment', val: activeProposal.briefScore.scope },
                    { label: 'Technical Coverage', val: activeProposal.briefScore.technical },
                    { label: 'Timeline Realism', val: activeProposal.briefScore.timeline }
                  ].map((score, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg text-center space-y-1">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{score.label}</span>
                      <p className="text-lg font-bold text-slate-200 font-outfit">{score.val}%</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Project Summary Draft</h3>
                  <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/30 p-3 rounded-lg border border-slate-900/50">
                    {activeProposal.projectSummary}
                  </p>
                </div>

                {sharePortalUrl && (
                  <div className="p-3 bg-blue-950/20 border border-blue-900/40 text-blue-400 text-xs rounded-lg space-y-1">
                    <p className="font-semibold">Public Client Share Portal Generated:</p>
                    <p className="font-mono bg-slate-950/50 p-2 rounded border border-slate-900 select-all overflow-x-auto text-[10px]">
                      {sharePortalUrl}
                    </p>
                    <p className="text-[10px] text-slate-500">This URL is secure, pin-gated, and collects telemetry metric charts on client views.</p>
                  </div>
                )}
              </Card>

              {/* Proposal Comments */}
              <Card className="space-y-4">
                <div className="flex items-center space-x-2 border-b border-slate-950 pb-3">
                  <MessageSquare className="w-4.5 h-4.5 text-blue-500" />
                  <h3 className="text-sm font-bold font-outfit text-white">Proposal Comments ({activeProposal.comments.length})</h3>
                </div>

                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {activeProposal.comments.map((comment) => (
                    <div key={comment.id} className="p-3 bg-slate-950/30 border border-slate-900/50 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="font-bold text-slate-400">{comment.sender}</span>
                        <span className="text-slate-600">{new Date(comment.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{comment.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCommentSubmit} className="flex gap-2 border-t border-slate-950 pt-3">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add section comment..."
                    required
                    className="flex-grow px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500"
                  />
                  <Button type="submit" variant="secondary" size="sm" className="px-3">
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </form>
              </Card>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 border border-dashed border-slate-900 rounded-xl text-xs text-slate-500">
              Select or generate a proposal to review details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default Proposals;
