import React, { useState } from 'react'
import { useLandingStore } from '../../store/useLandingStore'
import { Settings, GitBranch, Shield, UserPlus, CheckCircle, RefreshCw } from 'lucide-react'

export function RoleOnboarding() {
  const {
    userRole,
    onboardingGithubConnected,
    onboardingWalletAddress,
    onboardingTeam,
    setGithubConnected,
    setWalletAddress,
    addTeamMember,
  } = useLandingStore()

  const [walletInput, setWalletInput] = useState(onboardingWalletAddress)
  const [newTeamEmail, setNewTeamEmail] = useState('')
  const [githubLoading, setGithubLoading] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const handleConnectGithub = () => {
    setGithubLoading(true)
    setTimeout(() => {
      setGithubLoading(false)
      setGithubConnected(true)
    }, 900)
  }

  const handleInviteMember = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTeamEmail || !newTeamEmail.includes('@')) return
    addTeamMember(newTeamEmail)
    setNewTeamEmail('')
  }

  const handleSaveAll = () => {
    setWalletAddress(walletInput)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Title */}
      <div>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Onboarding Blueprint</span>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
          <Settings className="text-[#2563EB]" /> Role Onboarding Workspace
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Configure matching parameters, connect engineering pipelines, and invite team stakeholders.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Side: Setup forms */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg space-y-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2 flex justify-between">
            <span>Onboarding Checklist</span>
            <span className="text-xs text-slate-400 font-semibold capitalize">Role: {userRole}</span>
          </div>

          {/* GitHub Connection */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1">
              <GitBranch size={14} className="text-slate-400" /> GitHub Repository Pipeline
            </span>

            <div className="p-4 border border-[#D9E0E8] bg-[#F7F8FA] rounded flex justify-between items-center">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {onboardingGithubConnected ? 'suvam-dev' : 'Disconnected'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {onboardingGithubConnected
                    ? '14 public repositories indexed'
                    : 'Index your commits to build confidence scores'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleConnectGithub}
                disabled={githubLoading || onboardingGithubConnected}
                className="px-3 py-1.5 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-xs rounded transition-colors disabled:opacity-75 cursor-pointer"
              >
                {githubLoading ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : onboardingGithubConnected ? (
                  'Connected'
                ) : (
                  'Connect GitHub'
                )}
              </button>
            </div>
          </div>

          {/* Wallet Binding */}
          <div className="space-y-3 pt-3 border-t border-[#D9E0E8]">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block flex items-center gap-1">
              <Shield size={14} className="text-slate-400" /> Wallet Address Binding (Polygon)
            </span>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="e.g. 0x2563EB...173ea5"
                value={walletInput}
                onChange={(e) => setWalletInput(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB] font-mono"
              />
              <p className="text-[10px] text-slate-400 leading-normal">
                USDC releases and soulbound credentials will route directly to this address.
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="pt-4 border-t border-[#D9E0E8]">
            <button
              onClick={handleSaveAll}
              className="w-full py-2.5 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-xs rounded transition-colors cursor-pointer"
            >
              Save Configuration Settings
            </button>
            {saveSuccess && (
              <p className="text-xs font-semibold text-emerald-600 mt-2 text-center flex items-center justify-center gap-1.5">
                <CheckCircle size={14} /> Profile parameters updated in matching index.
              </p>
            )}
          </div>
        </div>

        {/* Right Side: Team invitation list */}
        <div className="bg-white border border-[#D9E0E8] p-6 rounded-lg space-y-6">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-[#D9E0E8] pb-2 flex items-center gap-1.5">
            <UserPlus size={14} className="text-slate-400" /> Workspace Team Seats
          </div>

          {/* Invite form */}
          <form onSubmit={handleInviteMember} className="space-y-2">
            <label htmlFor="team-invite" className="block text-xs font-bold text-slate-600">Invite Stakeholder</label>
            <div className="flex gap-2">
              <input
                id="team-invite"
                type="email"
                placeholder="collaborator@company.com"
                value={newTeamEmail}
                onChange={(e) => setNewTeamEmail(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-[#D9E0E8] rounded text-xs focus:outline-none focus:border-[#2563EB]"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded transition-all cursor-pointer"
              >
                Invite
              </button>
            </div>
          </form>

          {/* Members List */}
          <div className="space-y-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Authorized Members</span>
            <div className="border border-[#D9E0E8] rounded divide-y divide-[#D9E0E8]">
              {onboardingTeam.map((email, idx) => (
                <div key={idx} className="p-3 text-xs text-slate-700 flex justify-between items-center bg-slate-50">
                  <span>{email}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {idx === 0 ? 'Admin' : 'Member'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
