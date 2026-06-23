import React, { useState } from 'react'
import { ArrowLeft, ArrowRight, ShieldCheck, Mail, Lock } from 'lucide-react'
import { useLandingStore } from '../store/useLandingStore'
import { Brand } from '../components/Brand'
import { audiences } from '../data/landing'

export function Signup() {
  const { login, setPage } = useLandingStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<'client' | 'freelancer' | 'agency' | 'developer'>('client')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email) {
      setError('Email is required.')
      return
    }
    if (!email.includes('@')) {
      setError('Please enter a valid work email.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      login(email, selectedRole)
      // On signup, go to the onboarding page first
      window.location.hash = '#/dashboard/role-onboarding'
    }, 850)
  }

  // Find explanation copy
  const activeAudience = audiences.find((a) => a.id === selectedRole)

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-between py-12 px-6">
      <header className="max-w-md w-full mx-auto flex items-center justify-between">
        <a href="#/" onClick={() => setPage('landing')} className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft size={16} /> Back to home
        </a>
        <Brand compact />
      </header>

      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white border border-[#D9E0E8] rounded-lg p-8 shadow-sm">
          <div className="mb-8">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Registration</span>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Request access</h1>
            <p className="text-slate-500 text-sm mt-2">Create an account to structure project briefs, link proof, and fund milestones.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-orange-50 border border-orange-200 text-[#C2410C] text-sm rounded flex items-center gap-2" role="alert">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}

            {/* Role Selector Grid */}
            <div className="space-y-2">
              <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Select Your System Role</span>
              <div className="grid grid-cols-2 gap-2">
                {(['client', 'freelancer', 'agency', 'developer'] as const).map((r) => {
                  const roleDef = audiences.find((a) => a.id === r)
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedRole(r)}
                      className={`p-3 border rounded text-left flex flex-col justify-between h-20 transition-all ${
                        selectedRole === r
                          ? 'border-[#2563EB] bg-[#EDF4FF] text-slate-900 ring-1 ring-[#2563EB]'
                          : 'border-[#D9E0E8] bg-white text-slate-600 hover:border-slate-400'
                      }`}
                    >
                      <span className="text-xs font-bold capitalize">{r}</span>
                      <span className="text-[10px] text-slate-400 leading-tight line-clamp-2">
                        {roleDef?.burden.split(',')[0]}
                      </span>
                    </button>
                  )
                })}
              </div>
              {activeAudience && (
                <p className="text-xs text-slate-500 mt-2 bg-slate-50 border border-slate-100 p-2.5 rounded">
                  <span className="font-semibold text-slate-700">Onboarding outcome:</span> {activeAudience.outcome}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Work Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Mail size={16} />
                </span>
                <input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#D9E0E8] rounded focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-sm text-slate-900 transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Choose Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                  <Lock size={16} />
                </span>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-[#D9E0E8] rounded focus:outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-sm text-slate-900 transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 hover:bg-[#2563EB] text-white font-bold text-sm rounded transition-colors disabled:opacity-75 cursor-pointer"
            >
              {loading ? 'Registering Workspace...' : 'Initialize Onboarding'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#D9E0E8] flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium text-slate-400">
              <ShieldCheck size={14} className="text-emerald-500" /> Complies with GDPR
            </span>
            <span>
              Registered?{' '}
              <a href="#/login" onClick={() => setPage('login')} className="font-bold text-[#2563EB] hover:text-[#173EA5]">
                Log in
              </a>
            </span>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-400">
        © {new Date().getFullYear()} FixFlowAI. All rights reserved.
      </footer>
    </div>
  )
}
