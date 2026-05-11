import { Monitor, Moon, Sun } from 'lucide-react'
import useThemeStore from '@/stores/themeStore'
import { cn } from '@/lib/utils'

const themes = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'modern-dark', label: 'Dark', icon: Moon },
  { id: 'vscode-dark', label: 'VS Code', icon: Monitor },
]

function ThemeSwitcher({ compact = false, className }) {
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl border border-border bg-card/75 p-1 shadow-sm backdrop-blur-xl',
        className
      )}
      aria-label="Theme selector"
    >
      {themes.map((item) => {
        const Icon = item.icon
        const isActive = theme === item.id

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setTheme(item.id)}
            className={cn(
              'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all',
              isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              compact && 'w-8 px-0'
            )}
            title={item.label}
            aria-label={`Use ${item.label} theme`}
            aria-pressed={isActive}
          >
            <Icon className="h-4 w-4" />
            {!compact && <span className="hidden xl:inline">{item.label}</span>}
          </button>
        )
      })}
    </div>
  )
}

export default ThemeSwitcher
