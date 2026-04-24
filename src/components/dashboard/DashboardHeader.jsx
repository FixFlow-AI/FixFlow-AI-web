import { Search, Settings, LogOut, Menu } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'
import useAuthStore from '@/stores/authStore'
import NotificationCenter from '@/components/notifications/NotificationCenter'

function DashboardHeader({ onOpenSidebar }) {
  const navigate = useNavigate()
  const { user, currentWorkspace, logout } = useAuthStore()

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
          <div className="hidden xl:inline-flex rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
            {user?.defaultEntryMode === 'team' && currentWorkspace?.name
              ? `${currentWorkspace.name} · Team Mode`
              : `${user?.plan || 'free'} · Individual Mode`}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <NotificationCenter />

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/settings')}
            className="p-2 hover:bg-muted rounded-lg transition-colors hidden sm:inline-flex"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={handleLogout}
            className="p-2 hover:bg-muted rounded-lg transition-colors text-red-400 hover:text-red-500"
            title="Logout"
            data-testid="logout"
          >
            <LogOut className="h-5 w-5" />
          </motion.button>

          <motion.div 
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-2 pl-2 border-l border-border"
          >
            <Avatar src={user?.avatar || '/avatar.png'} fallback={getInitials(user?.name)} size="md" />
            {user?.name && (
              <span className="text-sm font-medium text-foreground hidden xl:block max-w-[140px] truncate">
                {user.name}
              </span>
            )}
          </motion.div>
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader
