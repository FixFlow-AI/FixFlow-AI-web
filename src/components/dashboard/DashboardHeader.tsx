import { Search, Bell, Settings } from 'lucide-react'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Avatar'

function DashboardHeader() {
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

          {/* User Avatar */}
          <Avatar fallback="JD" size="md" />
        </div>
      </div>
    </header>
  )
}

export default DashboardHeader
