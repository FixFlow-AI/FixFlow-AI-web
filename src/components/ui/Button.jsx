import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

const Button = forwardRef(
  ({ className, variant = 'default', size = 'md', isLoading, children, disabled, type = 'button', ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium transition-all duration-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:pointer-events-none'
    
    const variants = {
      default: 'bg-primary text-[#03131d] hover:bg-primary/90 shadow-lg shadow-primary/20',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border/80',
      outline: 'border border-border bg-transparent hover:bg-muted/80 text-foreground',
      ghost: 'hover:bg-muted text-foreground',
      destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
      warning: 'bg-amber-400/16 text-amber-200 border border-amber-300/30 hover:bg-amber-400/24',
      success: 'bg-emerald-400/16 text-emerald-200 border border-emerald-300/30 hover:bg-emerald-400/24',
    }
    
    const sizes = {
      sm: 'h-8 px-3 text-sm gap-1.5',
      md: 'h-10 px-4 text-sm gap-2',
      lg: 'h-12 px-6 text-base gap-2',
    }
    
    return (
      <button
        ref={ref}
        type={type}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
