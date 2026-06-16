export default function CommentMarker({ count = 0 }) {
  if (!count) {
    return null
  }

  return (
    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-medium text-primary">
      {count}
    </span>
  )
}
