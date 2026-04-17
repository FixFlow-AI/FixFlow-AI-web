import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import Sidebar from './Sidebar'
import DashboardHeader from '@/components/dashboard/DashboardHeader'

interface DashboardLayoutProps {
  children: ReactNode
}

function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="pl-[280px] min-h-screen flex flex-col">
        <DashboardHeader />
        
        <motion.main
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="flex-1 p-6"
        >
          {children}
        </motion.main>
      </div>
    </div>
  )
}

export default DashboardLayout
