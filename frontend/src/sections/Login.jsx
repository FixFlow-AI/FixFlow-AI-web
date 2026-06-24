import React, { useState } from "react";
import { ArrowLeft, ArrowRight, ShieldCheck, Mail, Lock } from "lucide-react";
import { useLandingStore } from "../store/useLandingStore";
import { Brand } from "../components/Brand";

export function Login() {
  const { login, setPage } = useLandingStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email) {
      setError("Email is required.");
      return;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid work email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      // Check role by email heuristic or default to developer/client
      let mockRole = "client";
      if (email.includes("dev") || email.includes("coder"))
        mockRole = "developer";
      else if (email.includes("free") || email.includes("design"))
        mockRole = "freelancer";
      else if (email.includes("agency") || email.includes("firm"))
        mockRole = "agency";

      login(email, mockRole);
      window.location.hash = "#/dashboard/overview";
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col justify-between py-12 px-6">
      <header className="max-w-md w-full mx-auto flex items-center justify-between">
        <a
          href="#/"
          onClick={() => setPage("landing")}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} /> Back to home
        </a>
        <Brand compact />
      </header>

      <main className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white border border-[#D9E0E8] rounded-lg p-8 shadow-sm">
          <div className="mb-8">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Access Portal
            </span>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
              Welcome back
            </h1>
            <p className="text-slate-500 text-sm mt-2">
              Enter your work credentials to open your project workspace.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div
                className="p-3 bg-orange-50 border border-orange-200 text-[#C2410C] text-sm rounded flex items-center gap-2"
                role="alert"
              >
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
              >
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
              <div className="flex justify-between items-center">
                <label
                  htmlFor="password"
                  className="block text-xs font-bold text-slate-700 uppercase tracking-wider"
                >
                  Password
                </label>
                <a
                  href="#/login"
                  onClick={(e) => e.preventDefault()}
                  className="text-xs font-semibold text-[#2563EB] hover:text-[#173EA5]"
                >
                  Forgot password?
                </a>
              </div>
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
              {loading ? "Verifying Credentials..." : "Open Workspace"}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#D9E0E8] flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium text-slate-400">
              <ShieldCheck size={14} className="text-emerald-500" /> Secure
              SHA-256 session
            </span>
            <span>
              New here?{" "}
              <a
                href="#/signup"
                onClick={() => setPage("signup")}
                className="font-bold text-[#2563EB] hover:text-[#173EA5]"
              >
                Request access
              </a>
            </span>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-slate-400">
        © {new Date().getFullYear()} FixFlowAI. All rights reserved.
      </footer>
    </div>
  );
}
