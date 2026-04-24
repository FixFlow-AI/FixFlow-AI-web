import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils'

export default function CommentThread({ comment, onResolve, canResolve = true }) {
  return (
    <div className="rounded-2xl border border-border bg-background/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{comment.authorName}</div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {comment.section} · {comment.type.replace('_', ' ')}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{formatDateTime(comment.createdAt)}</div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{comment.body}</p>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {comment.resolved ? 'Resolved' : 'Open'}
        </span>
        {canResolve && (
          <Button variant="outline" size="sm" onClick={() => onResolve(comment)}>
            {comment.resolved ? 'Reopen' : 'Resolve'}
          </Button>
        )}
      </div>
    </div>
  )
}
