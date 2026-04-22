import { Search, Bell, Settings, LogOut, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import useAuthStore from '@/stores/authStore'

function DashboardHeader({ onOpenSidebar }) {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  function getInitials(name) {
    if (!name) return '??'
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search proposals..." className="pl-10 bg-muted/50" />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button className="relative p-2 hover:bg-muted rounded-lg transition-colors hidden sm:inline-flex">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full" />
          </button>

          <button className="p-2 hover:bg-muted rounded-lg transition-colors hidden sm:inline-flex">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Logout"
            data-testid="logout"
          >
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-2">
            <Avatar fallback={getInitials(user?.name)} size="md" />
            {user?.name && (
              <span className="text-sm font-medium text-foreground hidden xl:block max-w-[140px] truncate">
                {user.name}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader
