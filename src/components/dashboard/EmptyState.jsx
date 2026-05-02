import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FileText, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center py-16 px-4"
    >
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
        <div className="relative h-20 w-20 rounded-2xl bg-transparent border border-border flex items-center justify-center transition-colors hover:bg-card focus-within:bg-card">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
      </div>
      
      <h3 className="text-xl font-semibold mb-2">No proposals yet</h3>
      <p className="text-muted-foreground text-center max-w-sm mb-6">
        Create your first proposal by uploading or pasting a client brief. Our AI will transform it into a structured, decision-ready document.
      </p>
      
      <Link to="/new">
        <Button className="glow-effect">
          <Plus className="h-4 w-4 mr-2" />
          Create Your First Proposal
        </Button>
      </Link>
    </motion.div>
  )
}

export default EmptyState
