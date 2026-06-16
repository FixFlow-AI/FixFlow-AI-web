import { cn } from '@/lib/utils'
import { API_BASE_URL } from '@/config/api'

function resolveAvatarSrc(src) {
  if (!src || src.startsWith('http') || src.startsWith('data:') || src.startsWith('/avatar')) {
    return src
  }

  if (src.startsWith('/api/')) {
    return `${API_BASE_URL.replace(/\/api$/, '')}${src}`
  }

  return src
}

function Avatar({ src, alt, fallback, size = 'md', className }) {
  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  }

  return (
    <div
      className={cn(
        'relative flex shrink-0 overflow-hidden rounded-full bg-muted',
        sizes[size],
        className
      )}
    >
      {src ? (
        <img
          src={resolveAvatarSrc(src)}
          alt={alt || ''}
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-primary/20 text-primary font-medium">
          {fallback || '?'}
        </span>
      )}
    </div>
  )
}

export { Avatar }
