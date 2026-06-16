import { Sheet } from '@/components/ui/Sheet'
import { Badge } from '@/components/ui/Badge'
import ConfidenceBar from './ConfidenceBar'
import { getConfidenceColor } from '@/lib/utils'

function DetailDrawer({ feature, isOpen, onClose }) {
  if (!feature) return null

  const confidenceColor = getConfidenceColor(feature.confidence_pct)

  const complexityVariant = {
    Low: 'success',
    Medium: 'warning',
    High: 'destructive',
  }

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={feature.title}
      description={feature.area}
    >
      <div className="space-y-6">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={complexityVariant[feature.complexity]}>
            {feature.complexity} Complexity
          </Badge>
          <Badge variant="outline">{feature.area}</Badge>
        </div>

        {/* Confidence */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Confidence Score</span>
            <span className="text-lg font-bold" style={{ color: confidenceColor }}>
              {feature.confidence_pct}%
            </span>
          </div>
          <ConfidenceBar percentage={feature.confidence_pct} animated={false} />
        </div>

        {/* Description */}
        <div>
          <h4 className="text-sm font-medium mb-2">Description</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {feature.description}
          </p>
        </div>

        {/* Technical Approach */}
        <div>
          <h4 className="text-sm font-medium mb-2">Technical Approach</h4>
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground leading-relaxed font-mono">
              {feature.technical_approach}
            </p>
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <h4 className="text-sm font-medium mb-2">Recommendations</h4>
          <ul className="space-y-2">
            {[
              'Start with a proof of concept to validate the approach',
              'Consider using established libraries to reduce development time',
              'Plan for comprehensive testing given the complexity',
              'Document architectural decisions for future maintainability',
            ].map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <div className="h-1.5 w-1.5 rounded-full bg-primary mt-2 shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Sheet>
  )
}

export default DetailDrawer
