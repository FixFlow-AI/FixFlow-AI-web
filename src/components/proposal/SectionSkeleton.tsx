import { Skeleton, SkeletonLine } from '@/components/ui/Skeleton'

interface SectionSkeletonProps {
  type?: 'grid' | 'list' | 'card'
}

function SectionSkeleton({ type = 'grid' }: SectionSkeletonProps) {
  if (type === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <SkeletonLine width="3/4" />
                <SkeletonLine width="1/2" />
              </div>
            </div>
            <SkeletonLine width="full" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (type === 'list') {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonLine width="3/4" />
              <SkeletonLine width="full" />
              <SkeletonLine width="1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-6 space-y-4">
      <SkeletonLine width="1/4" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-3 rounded-full" />
            <SkeletonLine width="3/4" />
            <Skeleton className="h-2 w-full flex-1" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default SectionSkeleton
