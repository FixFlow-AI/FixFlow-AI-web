import { useState } from 'react'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import DashboardHeader from '@/components/dashboard/DashboardHeader'
import WorkspaceBackdrop from '@/components/ui/WorkspaceBackdrop'
import { useNotificationStream } from '@/hooks/useNotificationStream'

function DashboardLayout({ children }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  useNotificationStream()

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <WorkspaceBackdrop />
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex min-h-screen min-w-0 flex-col lg:pl-[280px]">
        <DashboardHeader onOpenSidebar={() => setIsMobileSidebarOpen(true)} />

        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="app-surfaces min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6"
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}

export default DashboardLayout
