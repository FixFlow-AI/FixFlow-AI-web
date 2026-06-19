import React from 'react';
import Card from './Card.js';

interface StatBlockProps {
  title: string;
  value: string | number;
  change?: string;
  isPositive?: boolean;
  subtitle?: string;
  icon?: React.ReactNode;
}

export const StatBlock: React.FC<StatBlockProps> = ({
  title,
  value,
  change,
  isPositive = true,
  subtitle,
  icon
}) => {
  return (
    <Card hoverEffect className="flex items-start justify-between">
      <div className="space-y-1">
        <span className="text-xs font-medium text-slate-500 tracking-wider uppercase">{title}</span>
        <div className="flex items-baseline space-x-2">
          <span className="text-2xl font-bold font-outfit text-slate-100">{value}</span>
          {change && (
            <span className={`text-xs font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '↑' : '↓'} {change}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {icon && (
        <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-blue-400">
          {icon}
        </div>
      )}
    </Card>
  );
};
export default StatBlock;
