import React, { useState } from 'react';
import Card from '../../components/ui/Card.js';
import { ShieldAlert, Check } from 'lucide-react';

interface AdminAuditProps {
  mode: 'users' | 'audit' | 'analytics';
}

export const AdminAudit: React.FC<AdminAuditProps> = ({ mode }) => {
  const [users, setUsers] = useState([
    { id: 'usr-1', email: 'dev@fixflowai.com', role: 'USER', plan: 'SOLO', permissions: ['can_create_proposal', 'can_view_public_portal'] },
    { id: 'usr-2', email: 'alex@alphastream.com', role: 'MANAGER', plan: 'PRO', permissions: ['can_manage_leads', 'can_create_proposal'] },
    { id: 'usr-3', email: 'governor@fixflowai.com', role: 'SUPER_ADMIN', plan: 'AGENCY', permissions: ['can_audit_system', 'can_manage_users'] }
  ]);

  const togglePermission = (userId: string, permission: string) => {
    setUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          const hasPerm = u.permissions.includes(permission);
          const updatedPerms = hasPerm
            ? u.permissions.filter((p) => p !== permission)
            : [...u.permissions, permission];
          return { ...u, permissions: updatedPerms };
        }
        return u;
      })
    );
  };

  const auditEvents = [
    { timestamp: '2026-06-19T18:00:00Z', type: 'PAYOUT_RELEASE', actor: 'alex@alphastream.com', details: 'Released $5,950 for Milestone #2 (Escrow ID: esc-1) [MFA Verified]', status: 'SUCCESS' },
    { timestamp: '2026-06-19T17:45:00Z', type: 'MFA_AUTHENTICATE', actor: 'alex@alphastream.com', details: 'Passed TOTP step-up check', status: 'SUCCESS' },
    { timestamp: '2026-06-19T14:32:00Z', type: 'PROPOSAL_COMMENT', actor: 'dev@fixflowai.com', details: 'Added comment to Proposal #prp-1', status: 'SUCCESS' },
    { timestamp: '2026-06-19T10:05:00Z', type: 'ESCROW_FUNDED', actor: 'System', details: 'Virtual Account pay_vaccount_alpha123 funded', status: 'SUCCESS' }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-900 pb-4">
        <div>
          <h1 className="text-2xl font-bold font-outfit text-white">
            {mode === 'users' ? 'RBAC Permissions Manager' : mode === 'audit' ? 'System Audit Ledger' : 'Platform Telemetry'}
          </h1>
          <p className="text-xs text-slate-400">
            {mode === 'users' 
              ? 'Configure role capabilities, toggle access tokens, and edit subscriber permissions.' 
              : mode === 'audit'
              ? 'Real-time trace logs of critical financial transactions and security state changes.'
              : 'Aggregated operations metrics, volume, and developer retention indexes.'}
          </p>
        </div>
        <div className="p-2.5 bg-purple-950/10 border border-purple-900/35 rounded-lg text-purple-400">
          <ShieldAlert className="w-5 h-5" />
        </div>
      </div>

      {mode === 'users' && (
        <Card className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">System Users</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-900 text-slate-500 uppercase text-[9px] tracking-wider">
                  <th className="pb-3 pt-1 px-2">Email Address</th>
                  <th className="pb-3 pt-1 px-2">Role</th>
                  <th className="pb-3 pt-1 px-2">Sub Plan</th>
                  <th className="pb-3 pt-1 px-2">Capabilities / Permissions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {users.map((u) => (
                  <tr key={u.id} className="text-slate-300">
                    <td className="py-3.5 px-2 font-semibold">{u.email}</td>
                    <td className="py-3.5 px-2">
                      <span className="px-2 py-0.5 bg-slate-950 border border-slate-800 rounded font-outfit font-bold text-[10px]">
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-2 font-mono">{u.plan}</td>
                    <td className="py-3.5 px-2 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        {['can_create_proposal', 'can_manage_leads', 'can_audit_system'].map((perm) => {
                          const active = u.permissions.includes(perm);
                          return (
                            <button
                              key={perm}
                              onClick={() => togglePermission(u.id, perm)}
                              className={`px-2 py-1 rounded border text-[9px] font-medium font-mono transition-colors ${
                                active
                                  ? 'bg-purple-950/40 border-purple-900/30 text-purple-400'
                                  : 'bg-slate-950/20 border-slate-850 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {perm}
                            </button>
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {mode === 'audit' && (
        <Card className="space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Structured Activity Log</h2>
          <div className="space-y-3">
            {auditEvents.map((event, idx) => (
              <div key={idx} className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg flex flex-col sm:flex-row items-start justify-between gap-4 font-mono text-xs">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-1.5 py-0.5 bg-slate-950 border border-slate-850 rounded text-[9px] font-bold text-slate-400">
                      {event.type}
                    </span>
                    <span className="text-[10px] text-slate-500">{new Date(event.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-slate-300 text-[11px] leading-relaxed pt-1">{event.details}</p>
                  <p className="text-[10px] text-slate-500"><span className="text-slate-400">Actor:</span> {event.actor}</p>
                </div>
                <div className="flex items-center space-x-1.5 text-[10px] text-emerald-400 font-semibold bg-emerald-950/20 border border-emerald-900/25 px-2 py-0.5 rounded">
                  <Check className="w-3 h-3" />
                  <span>{event.status}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {mode === 'analytics' && (
        <div className="grid sm:grid-cols-2 gap-6">
          <Card className="p-5 space-y-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Escrow Volume (Monthly)</span>
            <p className="text-3xl font-bold font-outfit text-white">$142,500</p>
            <p className="text-xs text-slate-400">Total volume secured across active client contracts.</p>
          </Card>
          
          <Card className="p-5 space-y-2">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Average Payout Latency</span>
            <p className="text-3xl font-bold font-outfit text-white">4.2 Hours</p>
            <p className="text-xs text-slate-400">Mean duration between approval and bank account disbursement.</p>
          </Card>
        </div>
      )}
    </div>
  );
};
export default AdminAudit;
