import { Avatar } from '@/components/ui/Avatar'

export default function PresenceStack({ viewers = [] }) {
  if (!viewers.length) {
    return null
  }

  return (
    <div className="flex items-center">
      {viewers.slice(0, 5).map((viewer, index) => (
        <div key={viewer.userId} className="-ml-2 first:ml-0 rounded-full border border-background bg-background">
          <Avatar
            src={viewer.avatar || '/avatar.png'}
            fallback={viewer.avatarInitials || viewer.userName?.slice(0, 2)}
            size="sm"
            className="shadow-lg"
            style={{ transform: `translateX(${index * -2}px)` }}
          />
        </div>
      ))}
    </div>
  )
}
