import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import BriefInput from '@/components/proposal/BriefInput'
import FileUpload from '@/components/proposal/FileUpload'
import StreamingDisplay from '@/components/proposal/StreamingDisplay'
import { useStreamingProposal } from '@/hooks/useStreamingProposal'

function NewProposal() {
  const navigate = useNavigate()
  const [briefText, setBriefText] = useState('')
  const [fileKey, setFileKey] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const { generate, parsedSections, isGenerating, error, proposalId, resetStream } = useStreamingProposal()

  const canSubmit = briefText.trim().length > 50 || fileKey !== null

  useEffect(() => {
    if (!error) return
    toast.error(error)
  }, [error])

  useEffect(() => {
    if (!proposalId) return
    navigate(`/proposal/${proposalId}`)
  }, [navigate, proposalId])

  useEffect(() => () => resetStream(), [resetStream])

  const handleGenerate = async () => {
    await generate(briefText, fileKey)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Create New Proposal</h1>
        <p className="text-muted-foreground">
          Paste your client brief or upload a document to get started
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-8 space-y-8"
      >
        <BriefInput value={briefText} onChange={setBriefText} />

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-sm text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <FileUpload
          onFileUploaded={({ fileKey: nextFileKey }) => setFileKey(nextFileKey)}
          onFileRemoved={() => setFileKey(null)}
          onUploadingChange={setIsUploading}
        />

        <div className="pt-4">
          <Button
            onClick={handleGenerate}
            disabled={!canSubmit || isUploading || isGenerating}
            isLoading={isGenerating}
            className="w-full h-12 text-base glow-effect"
          >
            {isGenerating ? (
              'Generating Proposal...'
            ) : (
              <>
                Generate Proposal
                <ArrowRight className="h-5 w-5 ml-2" />
              </>
            )}
          </Button>

          {!canSubmit && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Please enter at least 50 characters or upload a file to continue
            </p>
          )}

          {isUploading && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Uploading your document before generation starts.
            </p>
          )}
        </div>
      </motion.div>

      {(isGenerating || Object.keys(parsedSections).length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-8 space-y-4"
        >
          <div>
            <h2 className="text-xl font-semibold">Live Proposal Preview</h2>
            <p className="text-sm text-muted-foreground">
              Sections will appear as the model streams them in.
            </p>
          </div>
          <StreamingDisplay parsedSections={parsedSections} isGenerating={isGenerating} />
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 p-6 rounded-xl border border-border bg-card/30"
      >
        <h3 className="font-semibold mb-3">Tips for better proposals</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">1.</span>
            Include specific project goals and success criteria
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">2.</span>
            Mention any technical constraints or preferences
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">3.</span>
            Describe your target users and their needs
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary mt-1">4.</span>
            Include timeline expectations and budget range if available
          </li>
        </ul>
      </motion.div>
    </div>
  )
}

export default NewProposal
