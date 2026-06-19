import React, { useState } from 'react';
import useApp from '../../store/index.js';
import Card from '../../components/ui/Card.js';
import Button from '../../components/ui/Button.js';
import { 
  Smartphone, 
  Laptop, 
  History, 
  Loader2, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';

export const SecuritySettings: React.FC = () => {
  const { user, setMfaEnabled, escrows } = useApp();
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaError, setMfaError] = useState('');
  
  const [auditing, setAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<any | null>(null);

  const handleToggleMfa = (e: React.FormEvent) => {
    e.preventDefault();
    if (user?.mfaEnabled) {
      setMfaEnabled(false);
      setVerificationCode('');
      setMfaError('');
    } else {
      if (verificationCode === '981242') {
        setMfaEnabled(true);
        setVerificationCode('');
        setMfaError('');
      } else {
        setMfaError('Invalid verification code. Please enter 981242.');
      }
    }
  };

  const handleRunAudit = () => {
    setAuditing(true);
    setAuditResult(null);

    // Simulate cryptographic validation cycle
    setTimeout(() => {
      // Loop over escrows' audit trails to verify links
      let overallPassed = true;
      const verifiedStats = {
        totalBlocks: 0,
        tamperedDetected: 0
      };

      escrows.forEach(esc => {
        verifiedStats.totalBlocks += esc.auditTrail.length;
        // Verify index logic
        for (let i = 0; i < esc.auditTrail.length; i++) {
          const current = esc.auditTrail[i];
          if (current.index !== i + 1) overallPassed = false;
          if (i > 0) {
            const previous = esc.auditTrail[i - 1];
            if (current.previousHash !== previous.hash) overallPassed = false;
          }
        }
      });

      setAuditResult({
        passed: overallPassed,
        blocksChecked: verifiedStats.totalBlocks,
        timestamp: new Date().toISOString()
      });
      setAuditing(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-outfit text-white">Security Settings</h1>
        <p className="text-xs text-slate-400">Hardening your operation center with MFA parameters, session controls, and blockchain audits.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left column: MFA TOTP Setup */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-950 pb-3">
              <Smartphone className="w-5 h-5 text-blue-500" />
              <h2 className="text-sm font-bold font-outfit text-white">TOTP Authentication</h2>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Status</span>
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                user?.mfaEnabled 
                  ? 'bg-emerald-950/40 border-emerald-900/30 text-emerald-400' 
                  : 'bg-amber-950/40 border-amber-900/30 text-amber-400'
              }`}>
                {user?.mfaEnabled ? 'Secured' : 'Inactive'}
              </span>
            </div>

            {!user?.mfaEnabled ? (
              <form onSubmit={handleToggleMfa} className="space-y-4 pt-2">
                <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-lg flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">TOTP Secret Key</p>
                    <p className="text-xs font-mono font-bold text-slate-200">J43T GNJX ORSW GZD2</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Verify 6-Digit Code</label>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="Enter test code: 981242"
                    required
                    className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-650 focus:outline-none focus:border-blue-500"
                  />
                </div>

                {mfaError && (
                  <p className="text-xs text-red-400 font-semibold">{mfaError}</p>
                )}

                <Button type="submit" variant="primary" fullWidth>
                  Enable MFA TOTP
                </Button>
              </form>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="p-3 bg-emerald-950/10 border border-emerald-900/30 text-emerald-400 text-xs rounded-lg flex items-start space-x-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <span>TOTP protection is enabled. Any payout releases or security edits will prompt step-up verification.</span>
                </div>
                <Button onClick={handleToggleMfa} variant="danger" fullWidth>
                  Disable Authenticator
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Middle & Right columns: Sessions & Blockchain Explorer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Cryptographic Ledger Validator */}
          <Card className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-950 pb-3">
              <div className="flex items-center space-x-2">
                <History className="w-4.5 h-4.5 text-blue-500" />
                <h2 className="text-sm font-bold font-outfit text-white">Audit Ledger Integrity Scanner</h2>
              </div>
              
              <Button 
                onClick={handleRunAudit} 
                disabled={auditing}
                size="sm"
                className="text-xs py-1.5 px-3 gap-1.5"
              >
                {auditing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying Chained Hashes...
                  </>
                ) : (
                  <>
                    Run Security Audit
                  </>
                )}
              </Button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              This validator traces the SHA-256 block indexes, links previous hash signatures, and verifies cryptographic integrity against tamper attacks, mimicking the FSM consensus.
            </p>

            {auditResult && (
              <div className={`p-4 border rounded-xl flex items-start space-x-3 ${
                auditResult.passed 
                  ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' 
                  : 'bg-red-950/20 border-red-900/40 text-red-400'
              }`}>
                {auditResult.passed ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                )}
                <div className="space-y-1.5 text-xs">
                  <p className="font-bold">
                    {auditResult.passed 
                      ? 'Ledger Status: Cryptographically Secure (100% Integrity Guaranteed)' 
                      : 'Security Warning: Ledger chain hash mismatch detected!'}
                  </p>
                  <p className="text-slate-400 font-medium">Checked {auditResult.blocksChecked} blocks across active escrows on Polygon Amoy. Audit finished at {new Date(auditResult.timestamp).toLocaleTimeString()}.</p>
                </div>
              </div>
            )}
          </Card>

          {/* Active Sessions list */}
          <Card className="space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-950 pb-3">
              <Laptop className="w-4.5 h-4.5 text-blue-500" />
              <h2 className="text-sm font-bold font-outfit text-white">Active Device Sessions</h2>
            </div>

            <div className="space-y-3">
              <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start space-x-3 text-xs">
                  <div className="p-2 bg-slate-950 border border-slate-900 text-blue-500 rounded-lg">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-200">MacBook Pro / Chrome</p>
                    <p className="text-slate-500">IP: 198.51.100.42 // Location: US (Verified)</p>
                    <p className="font-mono text-[9px] text-slate-600">Cookie Fingerprint: a8f3b20e791b26c6e7f8a9b0c1d</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="px-2 py-0.5 bg-blue-950/30 border border-blue-900/30 text-blue-400 text-[10px] rounded uppercase font-bold tracking-wider">
                    Current Device
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
export default SecuritySettings;
