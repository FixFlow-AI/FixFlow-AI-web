import { MessageSquareText } from 'lucide-react'

export default function DealRoomAnnotationBadge({ annotations = [] }) {
  if (!annotations.length) {
    return null
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <MessageSquareText className="h-4 w-4" />
        Client Deal Room notes
      </div>
      <div className="mt-3 space-y-3">
        {annotations.slice(0, 4).map((annotation) => (
          <div key={annotation.id} className="rounded-xl border border-border bg-background/40 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="uppercase tracking-[0.18em] text-muted-foreground">{annotation.sectionName}</span>
              <span className="capitalize text-primary">{annotation.type}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{annotation.comment}</p>
            {annotation.clientEmail ? <p className="mt-2 text-xs text-muted-foreground">{annotation.clientEmail}</p> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
