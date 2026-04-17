import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  Settings, 
  HelpCircle,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'New Proposal', href: '/new', icon: PlusCircle },
  { name: 'Proposals', href: '/dashboard', icon: FileText },
]

const secondaryNav = [
  { name: 'Settings', href: '/settings', icon: Settings },
  { name: 'Help', href: '/help', icon: HelpCircle },
]

function Sidebar() {
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <motion.aside
      initial={{ x: -280 }}
      animate={{ x: 0, width: isCollapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 h-screen bg-card border-r border-border flex flex-col z-40"
    >
      {/* Logo */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <Link to="/" className={cn("flex items-center gap-2", isCollapsed && "justify-center")}>
          <div className="relative">
            <div className="absolute inset-0 bg-primary/30 blur-lg rounded-full" />
            <Sparkles className="h-7 w-7 text-primary relative" />
          </div>
          {!isCollapsed && <span className="text-lg font-bold">Proplytics</span>}
        </Link>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "p-1.5 hover:bg-muted rounded-lg transition-colors",
            isCollapsed && "absolute -right-3 top-6 bg-card border border-border shadow-sm"
          )}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                isCollapsed && 'justify-center px-2'
              )}
            >
              <item.icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />
              {!isCollapsed && <span>{item.name}</span>}
              {isActive && !isCollapsed && (
                <motion.div
                  layoutId="activeIndicator"
                  className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                />
              )}
            </Link>
          )
        })}
      </nav>

      {/* Secondary Navigation */}
      <div className="p-4 border-t border-border space-y-1">
        {secondaryNav.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors',
              isCollapsed && 'justify-center px-2'
            )}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{item.name}</span>}
          </Link>
        ))}
      </div>

      {/* User Section */}
      <div className="p-4 border-t border-border">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2",
          isCollapsed && "justify-center px-0"
        )}>
          <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium shrink-0">
            JD
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">john@example.com</p>
            </div>
          )}
        </div>
      </div>
    </motion.aside>
  )
}

export default Sidebar
