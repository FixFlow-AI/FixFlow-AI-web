import React, { useState } from 'react';
import Card from '../../components/ui/Card.js';
import Button from '../../components/ui/Button.js';
import { User, Code, GitFork, GitCommit, CheckCircle2, Loader2 } from 'lucide-react';

export const ProfileScan: React.FC = () => {
  const [username, setUsername] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>({
    repos: ["portfolio", "proposal-generator", "telemetry-sync-server"],
    languages: { "TypeScript": 70, "Rust": 20, "CSS": 10 },
    commits: 412,
    lastScanned: "2026-06-19T20:00:00Z"
  });

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    setScanning(true);
    setScanResult(null);

    // Simulate Apify/Tavily scanning queue trigger
    setTimeout(() => {
      setScanResult({
        repos: ["main-api", "fsm-escrow-contracts", "next-auth-rotator"],
        languages: { "TypeScript": 60, "Go": 30, "Solidity": 10 },
        commits: 588,
        lastScanned: new Date().toISOString()
      });
      setScanning(false);
    }, 2500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white">GitHub Scanner</h1>
        <p className="text-xs text-slate-400">Verifying codebase experience, repository telemetry, and committing skills metadata.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Side: Scanner Form */}
        <div className="space-y-6">
          <Card className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Trigger New Scan</h2>
            
            <form onSubmit={handleScanSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">GitHub Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-4.5 h-4.5 text-slate-550" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="alexmercer"
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <Button type="submit" fullWidth disabled={scanning} className="gap-1.5">
                {scanning ? (
                  <>
                    <Loader2 className="w-4.5 h-4.5 animate-spin" /> Scanning repos...
                  </>
                ) : (
                  <>
                    <GitFork className="w-4.5 h-4.5" /> Start Code Scan
                  </>
                )}
              </Button>
            </form>
          </Card>
        </div>

        {/* Right Side: Scan Results */}
        <div className="lg:col-span-2">
          {scanResult ? (
            <Card className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-950 pb-4">
                <h2 className="text-sm font-bold font-outfit text-white">Vetting Output Credentials</h2>
                <span className="text-[10px] text-slate-500 font-medium">Scanned: {new Date(scanResult.lastScanned).toLocaleString()}</span>
              </div>

              <div className="grid sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg space-y-1 text-center">
                  <GitFork className="w-5 h-5 text-blue-500 mx-auto" />
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Repositories</p>
                  <p className="text-lg font-bold text-slate-200 font-outfit">{scanResult.repos.length} Checked</p>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg space-y-1 text-center">
                  <GitCommit className="w-5 h-5 text-purple-500 mx-auto" />
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Commit Footprint</p>
                  <p className="text-lg font-bold text-slate-200 font-outfit">{scanResult.commits} Commits</p>
                </div>

                <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg space-y-1 text-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto" />
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">DID Verification</p>
                  <p className="text-lg font-bold text-emerald-400 font-outfit">Active</p>
                </div>
              </div>

              {/* Language split */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Detected Language Telemetry</h3>
                <div className="space-y-2.5">
                  {Object.entries(scanResult.languages).map(([lang, pct]: any) => (
                    <div key={lang} className="space-y-1 text-xs">
                      <div className="flex justify-between text-slate-300">
                        <span>{lang}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-slate-950 border border-slate-900 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full"
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Repository list details */}
              <div className="space-y-3 border-t border-slate-950 pt-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Indexed Repositories</h3>
                <div className="grid sm:grid-cols-2 gap-2 text-xs">
                  {scanResult.repos.map((repo: string) => (
                    <div key={repo} className="p-3 bg-slate-950/20 border border-slate-900 rounded-lg flex items-center space-x-2">
                      <Code className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-300 font-mono">{repo}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          ) : scanning ? (
            <div className="flex flex-col items-center justify-center h-64 border border-slate-900 rounded-xl space-y-3">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
              <p className="text-xs text-slate-500">Crawling public repositories & counting commits footprint...</p>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 border border-dashed border-slate-900 rounded-xl text-xs text-slate-500">
              Trigger a GitHub scan to load codebase intelligence metrics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ProfileScan;
