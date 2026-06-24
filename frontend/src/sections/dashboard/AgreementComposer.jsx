import { useState } from "react";
import { useLandingStore } from "../../store/useLandingStore";
import {
  FileSignature,
  CheckCircle,
  ShieldAlert,
  Edit3,
  Save,
} from "lucide-react";

export function AgreementComposer() {
  const { milestones, isAgreementSigned, signAgreement } = useLandingStore();

  const [selectedMilestoneId, setSelectedMilestoneId] = useState("m1");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingAmount, setEditingAmount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  const activeMilestone = milestones.find((m) => m.id === selectedMilestoneId);

  const handleEditClick = () => {
    if (activeMilestone) {
      setEditingTitle(activeMilestone.title);
      setEditingAmount(activeMilestone.amount);
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (activeMilestone) {
      activeMilestone.title = editingTitle;
      activeMilestone.amount = Number(editingAmount);
      setIsEditing(false);
    }
  };

  const bothSigned = isAgreementSigned.client && isAgreementSigned.freelancer;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
          Subsystem 04
        </span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <FileSignature className="text-[#2563EB]" /> Working Agreement
          Composer
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Harden proposal terms into scoped milestones with binding acceptance
          criteria and escrow release rules.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel: Milestone Editor */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg lg:col-span-1 space-y-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2">
            Milestone Composer
          </div>

          <div className="space-y-3">
            {milestones.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMilestoneId(m.id);
                  setIsEditing(false);
                }}
                className={`w-full text-left p-3 border rounded text-xs transition-all flex justify-between items-center cursor-pointer ${
                  selectedMilestoneId === m.id
                    ? "border-[#2563EB] bg-[#EDF4FF] ring-1 ring-[#2563EB]"
                    : "border-[#D9E0E8] bg-white hover:border-slate-400"
                }`}
              >
                <span className="font-semibold line-clamp-1">{m.title}</span>
                <span className="font-bold text-slate-700 font-mono text-[10px]">
                  ${m.amount.toLocaleString()}
                </span>
              </button>
            ))}
          </div>

          {activeMilestone && (
            <div className="pt-4 border-t border-[#D9E0E8] space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Inspect Milestone
                </span>
                {!isEditing && !bothSigned && (
                  <button
                    onClick={handleEditClick}
                    className="text-[#2563EB] hover:text-[#173EA5] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="m-title"
                      className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      Milestone Title
                    </label>
                    <input
                      id="m-title"
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="w-full p-2 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="m-amount"
                      className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider"
                    >
                      Scope Budget (USDC)
                    </label>
                    <input
                      id="m-amount"
                      type="number"
                      value={editingAmount}
                      onChange={(e) => setEditingAmount(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB]"
                    />
                  </div>

                  <button
                    onClick={handleSave}
                    className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Save size={12} /> Save Changes
                  </button>
                </div>
              ) : (
                <div className="space-y-2 text-xs text-slate-600 leading-relaxed bg-[#F7F8FA] p-4 rounded border border-slate-100">
                  <p>
                    <strong>Title:</strong> {activeMilestone.title}
                  </p>
                  <p>
                    <strong>Escrow Value:</strong> $
                    {activeMilestone.amount.toLocaleString()} USDC
                  </p>
                  <p className="mt-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Agreed Release Checklists:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 mt-1 text-[11px]">
                    <li>Verified code commits pushed on main branch.</li>
                    <li>Successful test coverage run reporting &gt;85%.</li>
                    <li>Technical document artifact generated.</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel: Contract Preview & Signatures */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg lg:col-span-2 space-y-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2">
            Agreement Executive Deed
          </div>

          <div className="space-y-4 text-xs text-slate-600 bg-slate-50 p-6 rounded border border-slate-200 leading-relaxed font-sans">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-2 mb-3">
              COVENANT OF WORK AGREEMENT
            </h3>
            <p>
              This document legally binds the client and freelancer under the
              terms of the Northstar Billing Migration project. Funds deposited
              in the virtual smart escrow contract are subject to strict release
              checkpoints.
            </p>
            <p className="font-semibold text-slate-800 mt-3">
              Active Escrow Milestones:
            </p>
            <ol className="list-decimal pl-4 space-y-1.5 mt-1 font-mono text-[11px]">
              {milestones.map((m) => (
                <li key={m.id}>
                  {m.title} —{" "}
                  <span className="font-bold">
                    ${m.amount.toLocaleString()} USDC
                  </span>
                </li>
              ))}
            </ol>

            {bothSigned && (
              <div className="mt-4 pt-3 border-t border-slate-200 space-y-1 font-mono text-[10px] text-slate-500">
                <p>
                  Escrow State Machine Address:{" "}
                  <span className="text-slate-700 font-semibold">
                    0x2b8d96e5782782b6c69f2e463a5f782737ef39ce
                  </span>
                </p>
                <p>
                  Polygon Network Registry Status:{" "}
                  <span className="text-emerald-600 font-semibold">ACTIVE</span>
                </p>
              </div>
            )}
          </div>

          {/* Signatures Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-[#D9E0E8] pt-6">
            <div className="p-4 border border-[#D9E0E8] rounded space-y-3 bg-[#F7F8FA] flex flex-col justify-between h-32">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Client Authentication
                </span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">
                  Northstar Org Officer
                </span>
              </div>
              {isAgreementSigned.client ? (
                <span className="text-emerald-600 font-bold text-xs flex items-center gap-1.5">
                  <CheckCircle size={16} /> Signed cryptographically
                </span>
              ) : (
                <button
                  onClick={() => signAgreement("client")}
                  className="w-full py-2 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-xs rounded transition-colors cursor-pointer"
                >
                  Authorize Signature
                </button>
              )}
            </div>

            <div className="p-4 border border-[#D9E0E8] rounded space-y-3 bg-[#F7F8FA] flex flex-col justify-between h-32">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Freelancer Authentication
                </span>
                <span className="text-xs font-bold text-slate-800 mt-1 block">
                  Match Candidate
                </span>
              </div>
              {isAgreementSigned.freelancer ? (
                <span className="text-emerald-600 font-bold text-xs flex items-center gap-1.5">
                  <CheckCircle size={16} /> Signed cryptographically
                </span>
              ) : (
                <button
                  onClick={() => signAgreement("freelancer")}
                  className="w-full py-2 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-xs rounded transition-colors cursor-pointer"
                >
                  Authorize Signature
                </button>
              )}
            </div>
          </div>

          {bothSigned ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-[#16A34A] rounded text-xs flex items-center gap-2">
              <CheckCircle size={16} /> Both parties signed. Escrow is locked.
              Ready to deposit capital.
            </div>
          ) : (
            <div className="p-3 bg-orange-50 border border-orange-200 text-[#C2410C] rounded text-xs flex items-center gap-2">
              <ShieldAlert size={16} /> Waiting for signatures before escrow
              state transitions can execute.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
