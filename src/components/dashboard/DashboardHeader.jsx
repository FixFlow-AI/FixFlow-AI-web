import { Search, Bell, Settings, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import useAuthStore from '@/stores/authStore'

function DashboardHeader() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()

  function getInitials(name) {
    if (!name) return '??'
    return name
      .split(' ')
      .map((n) => n[0])
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
      <div className="flex items-center justify-between px-6 py-4">
        {/* Search */}
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search proposals..."
            className="pl-10 bg-muted/50"
          />
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2 hover:bg-muted rounded-lg transition-colors">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-primary rounded-full" />
          </button>

          {/* Settings */}
          <button className="p-2 hover:bg-muted rounded-lg transition-colors">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* User Avatar */}
          <div className="flex items-center gap-2">
            <Avatar fallback={getInitials(user?.name)} size="md" />
            {user?.name && (
              <span className="text-sm font-medium text-foreground hidden lg:block">
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
