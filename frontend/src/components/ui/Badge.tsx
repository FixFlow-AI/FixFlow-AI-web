import React from 'react';

interface BadgeProps {
  label: string;
}

export const Badge: React.FC<BadgeProps> = ({ label }) => {
  const cleanLabel = (label || '').trim().toUpperCase();

  const getStyle = () => {
    switch (cleanLabel) {
      case 'SCOPE_CREEP_RISK':
        return 'bg-amber-950/45 border-amber-900/50 text-amber-400';
      case 'LATE_PAYER_RISK':
        return 'bg-orange-950/45 border-orange-900/50 text-orange-400';
      case 'HIGH_DISPUTE_RISK':
      case 'HIGH_DISPUTE_RATE_WARNING':
        return 'bg-red-950/50 border-red-900/50 text-red-400 font-semibold';
      case 'PREMIUM_CLIENT':
        return 'bg-emerald-950/45 border-emerald-900/50 text-emerald-400';
      default:
        return 'bg-slate-900 border-slate-800 text-slate-400';
    }
  };

  const getHumanText = () => {
    switch (cleanLabel) {
      case 'SCOPE_CREEP_RISK':
        return 'Scope Creep Risk';
      case 'LATE_PAYER_RISK':
        return 'Late Payer Risk';
      case 'HIGH_DISPUTE_RISK':
      case 'HIGH_DISPUTE_RATE_WARNING':
        return 'High Dispute Risk';
      case 'PREMIUM_CLIENT':
        return 'Premium Client';
      default:
        return label;
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs border uppercase tracking-wider font-medium font-outfit ${getStyle()}`}>
      {getHumanText()}
    </span>
  );
};
export default Badge;
