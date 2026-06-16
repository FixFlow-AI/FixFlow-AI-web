export default function ApprovalBadge({ approved = false }) {
  if (!approved) {
    return null
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
      Approved
    </span>
  )
}
