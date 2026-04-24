import { motion } from 'framer-motion'

export default function WinRateDonut({ winRate = 0 }) {
  const safeRate = Math.max(0, Math.min(100, winRate))
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (safeRate / 100) * circumference

  return (
    <div className="glass-card rounded-[28px] p-6">
      <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Win Rate</p>
      <div className="mt-6 flex items-center justify-center">
        <div className="relative flex h-40 w-40 items-center justify-center">
          <svg className="-rotate-90" viewBox="0 0 140 140">
            <circle cx="70" cy="70" r="54" stroke="rgba(255,255,255,0.08)" strokeWidth="10" fill="none" />
            <motion.circle
              cx="70"
              cy="70"
              r="54"
              stroke="#26d07c"
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </svg>
          <div className="absolute text-center">
            <div className="text-4xl font-bold">{safeRate}%</div>
            <div className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Closed deals</div>
          </div>
        </div>
      </div>
    </div>
  )
}
