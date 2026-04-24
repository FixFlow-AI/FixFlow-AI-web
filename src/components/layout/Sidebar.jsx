import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  BarChart3,
  Settings,
  HelpCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import useAuthStore from '@/stores/authStore'
import { Sheet } from '@/components/ui/Sheet'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'New Proposal', href: '/new', icon: PlusCircle },
  { name: 'Proposals', href: '/dashboard', icon: FileText },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
]

const secondaryNav = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
]

function NavLinks({ items, isCollapsed, location, onNavigate }) {
  return items.map((item) => {
    const isActive = location.pathname === item.href

    return (
      <Link
        key={item.name}
        to={item.href}
        onClick={onNavigate}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted',
          isCollapsed && 'justify-center px-2'
        )}
      >
        <item.icon className={cn('h-5 w-5 shrink-0', isActive && 'text-primary')} />
        {!isCollapsed && <span>{item.name}</span>}
        {isActive && !isCollapsed && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
      </Link>
    )
  })
}

function SidebarContent({ isCollapsed, onToggleCollapse, location, user, onNavigate, mobile = false }) {
  const initials = user?.name
    ? user.name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2)
    : '??'

  return (
    <>
      <div className="flex items-center justify-between p-6 border-b border-border">
        <Link to="/" onClick={onNavigate} className={cn('flex items-center gap-2', isCollapsed && 'justify-center')}>
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full" />
            <Sparkles className="h-7 w-7 text-primary relative" />
          </div>
          {!isCollapsed && <span className="text-lg font-bold">Proplytics</span>}
        </Link>

        {!mobile && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              'p-1.5 hover:bg-muted rounded-lg transition-colors',
              isCollapsed && 'absolute -right-3 top-6 bg-card border border-border shadow-sm'
            )}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <NavLinks items={navigation} isCollapsed={isCollapsed} location={location} onNavigate={onNavigate} />
      </nav>

      <div className="p-4 border-t border-border space-y-1">
        <NavLinks items={secondaryNav} isCollapsed={isCollapsed} location={location} onNavigate={onNavigate} />
      </div>

      <div className="p-4 border-t border-border">
        <div className={cn('flex items-center gap-3 px-3 py-2', isCollapsed && 'justify-center px-0')}>
          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium shrink-0 overflow-hidden shadow-sm">
            {user?.avatar ? (
              <img src={user.avatar} alt="Avatar" className="w-full h-full object-cover scale-110" />
            ) : (
              <img src="/avatar.png" alt="Avatar" className="w-full h-full object-cover scale-110" />
            )}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user?.name || 'User'}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ''}</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function Sidebar({ isMobileOpen, onMobileClose }) {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const user = useAuthStore((state) => state.user)

  return (
    <>
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: 0, width: isCollapsed ? 80 : 280 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="fixed left-0 top-0 h-screen bg-card border-r border-border hidden lg:flex flex-col z-40"
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((value) => !value)}
          location={location}
          user={user}
        />
      </motion.aside>

      <Sheet
        isOpen={isMobileOpen}
        onClose={onMobileClose}
        side="left"
        className="max-w-xs"
      >
        <div className="-m-6 h-full flex flex-col">
          <SidebarContent
            isCollapsed={false}
            location={location}
            user={user}
            mobile
            onNavigate={onMobileClose}
          />
        </div>
      </Sheet>
    </>
  )
}

export default Sidebar
