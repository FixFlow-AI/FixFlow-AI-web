import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

const circumference = 2 * Math.PI * 54

function getTone(score) {
  if (score >= 70) return 'text-emerald-300'
  if (score >= 41) return 'text-amber-200'
  return 'text-rose-300'
}

function getStroke(score) {
  if (score >= 70) return '#26d07c'
  if (score >= 41) return '#f7b955'
  return '#ff6b6b'
}

export default function ScoreDial({ score = 0, grade = 'Poor' }) {
  const safeScore = Math.max(0, Math.min(100, score))
  const offset = circumference - (safeScore / 100) * circumference

  return (
    <div className="relative flex h-44 w-44 items-center justify-center rounded-full border border-border bg-transparent transition-colors hover:bg-background/50 focus-within:bg-background/50">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="54" stroke="rgba(255,255,255,0.07)" strokeWidth="8" fill="none" />
        <motion.circle
          cx="70"
          cy="70"
          r="54"
          stroke={getStroke(safeScore)}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="relative z-10 text-center">
        <div className={cn('text-5xl font-bold tracking-tight', getTone(safeScore))}>{safeScore}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.28em] text-muted-foreground">BriefScore</div>
        <div className="mt-2 text-sm font-medium text-foreground">{grade}</div>
      </div>
    </div>
  )
}
