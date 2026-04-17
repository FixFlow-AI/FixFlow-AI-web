import { motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import ConfidenceBar from './ConfidenceBar'
import { cn, getConfidenceColor, getConfidenceLabel } from '@/lib/utils'
import type { FeatureItem } from '@/lib/mock-data'

interface ConfidenceCardProps {
  feature: FeatureItem
  onClick: () => void
  index?: number
}

function ConfidenceCard({ feature, onClick, index = 0 }: ConfidenceCardProps) {
  const confidenceColor = getConfidenceColor(feature.confidence_pct)
  const confidenceLabel = getConfidenceLabel(feature.confidence_pct)

  const complexityVariant = {
    Low: 'success',
    Medium: 'warning',
    High: 'destructive',
  } as const

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className="relative flex rounded-xl border border-border bg-card overflow-hidden cursor-pointer hover:border-primary/30 transition-all duration-300 group"
    >
      {/* Left Color Accent Bar */}
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: '100%' }}
        transition={{ duration: 0.5, delay: index * 0.08 + 0.2 }}
        className="w-1.5 shrink-0"
        style={{ backgroundColor: confidenceColor }}
      />

      {/* Content */}
      <div className="flex-1 p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-1 group-hover:text-primary transition-colors line-clamp-1">
              {feature.title}
            </h4>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {feature.description}
            </p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </div>

        {/* Confidence Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">Confidence</span>
            <span className="font-medium" style={{ color: confidenceColor }}>
              {feature.confidence_pct}%
            </span>
          </div>
          <ConfidenceBar percentage={feature.confidence_pct} delay={index * 0.08 + 0.3} />
        </div>

        {/* Footer Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={complexityVariant[feature.complexity]} className="text-[10px]">
            {feature.complexity} Complexity
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {feature.area}
          </Badge>
        </div>
      </div>
    </motion.div>
  )
}

export default ConfidenceCard
