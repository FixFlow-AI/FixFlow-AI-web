import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import CommentInput from '@/components/comments/CommentInput'
import CommentThread from '@/components/comments/CommentThread'
import api from '@/config/api'

const SECTIONS = ['summary', 'features', 'risks', 'timeline', 'effort', 'market', 'impact']

export default function CommentsSidebar({ proposalId, comments = [], onCommentsChange, canComment = true, onClose }) {
  const handleCreate = async (payload) => {
    try {
      const { data } = await api.post(`/proposals/${proposalId}/comments`, payload)
      onCommentsChange?.(data.comments)
      toast.success('Comment added.')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to add comment.')
    }
  }

  const handleResolve = async (comment) => {
    try {
      const { data } = await api.patch(`/proposals/${proposalId}/comments/${comment._id}`, {
        resolved: !comment.resolved,
      })
      onCommentsChange?.(data.comments)
      toast.success(comment.resolved ? 'Comment reopened.' : 'Comment resolved.')
    } catch (error) {
      toast.error(error.response?.data?.error || 'Unable to update comment.')
    }
  }

  return (
    <div className="flex h-full flex-col border-l border-border bg-card/95 p-5 backdrop-blur-xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Comments</h3>
          <p className="text-sm text-muted-foreground">Leave team review notes on specific sections.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <CommentInput onSubmit={handleCreate} sections={SECTIONS} disabled={!canComment} />

      <div className="mt-6 flex-1 space-y-3 overflow-y-auto pr-1">
        {comments.length ? comments.map((comment) => (
          <CommentThread key={comment._id} comment={comment} onResolve={handleResolve} canResolve={canComment} />
        )) : (
          <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted-foreground">
            No comments yet. Start the review thread here.
          </div>
        )}
      </div>
    </div>
  )
}
