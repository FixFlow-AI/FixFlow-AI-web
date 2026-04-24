import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Gauge } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import BriefInput from '@/components/proposal/BriefInput'
import FileUpload from '@/components/proposal/FileUpload'
import StreamingDisplay from '@/components/proposal/StreamingDisplay'
import { useStreamingProposal } from '@/hooks/useStreamingProposal'
import { useBriefScore } from '@/hooks/useBriefScore'
import BriefScorePanel from '@/components/briefScore/BriefScorePanel'

function NewProposal() {
  const navigate = useNavigate()
  const [briefText, setBriefText] = useState('')
  const [fileKey, setFileKey] = useState(null)
  const [isUploading, setIsUploading] = useState(false)
  const { generate, parsedSections, isGenerating, error, proposalId, resetStream } = useStreamingProposal()
  const { briefScore, isLoading: isScoring, error: briefScoreError, canAnalyze, wordCount } = useBriefScore(briefText, fileKey)

  const canSubmit = briefText.trim().length > 50 || fileKey !== null

  useEffect(() => {
    if (!error) return
    toast.error(error)
  }, [error])

  useEffect(() => {
    if (!briefScoreError) return
    toast.error(briefScoreError)
  }, [briefScoreError])

  useEffect(() => {
    if (!proposalId) return
    navigate(`/proposal/${proposalId}`)
  }, [navigate, proposalId])

  useEffect(() => () => resetStream(), [resetStream])

  const handleGenerate = async () => {
    await generate(briefText, fileKey, null, briefScore)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-10"
      >
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">Create New Proposal</h1>
        <p className="max-w-3xl text-muted-foreground">
          Paste a client brief or upload a discovery file. Proplytics will score the input first, then generate the proposal with the brief-quality snapshot attached.
        </p>
      </motion.div>

      <div className="grid gap-8 xl:grid-cols-[1fr_0.95fr]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-[28px] p-8 space-y-8"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-primary">Intake</p>
              <h2 className="mt-2 text-2xl font-semibold">Brief intake workspace</h2>
            </div>
            <div className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground">
              {fileKey ? 'File attached' : `${wordCount} words`}
            </div>
          </div>

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
              data-testid="generate-proposal"
              onClick={handleGenerate}
              disabled={!canSubmit || isUploading || isGenerating}
              isLoading={isGenerating}
              variant={briefScore && !briefScore.readyToGenerate ? 'warning' : 'default'}
              className="w-full h-12 text-base glow-effect"
            >
              {isGenerating ? (
                'Generating Proposal...'
              ) : briefScore && !briefScore.readyToGenerate ? (
                <>
                  Generate Anyway
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
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

            {briefScore && !briefScore.readyToGenerate && (
              <p className="mt-3 rounded-2xl border border-amber-300/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
                The brief has gaps that may reduce proposal accuracy. You can still generate now, but the suggestions below will improve the output.
              </p>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="glass-card rounded-[28px] p-8"
        >
          <div className="flex items-center gap-3">
            <Gauge className="h-5 w-5 text-primary" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-primary">Guidance</p>
              <h2 className="mt-1 text-xl font-semibold">What makes a strong brief?</h2>
            </div>
          </div>

          <div className="mt-6 space-y-3 text-sm text-muted-foreground">
            <p>Great proposals happen when the input includes concrete scope, technical constraints, timing, stakeholders, and measurable outcomes.</p>
            <p>BriefScore appears automatically after enough input is available, then the exact score snapshot is stored with the generated proposal for later analytics.</p>
          </div>

          <div className="mt-8 space-y-3">
            {[
              'List the actual modules, workflows, or deliverables you expect.',
              'Mention any must-have integrations, platforms, or internal systems.',
              'Include the launch window, deadlines, and budget if available.',
              'Name the approvers, operators, and target user groups.',
            ].map((tip, index) => (
              <div key={tip} className="rounded-2xl border border-border bg-background/35 px-4 py-3 text-sm text-muted-foreground">
                <span className="mr-3 text-primary">0{index + 1}</span>
                {tip}
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {(canAnalyze || isScoring || briefScore) && (
        <motion.div
          data-testid="brief-score-panel"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <BriefScorePanel briefScore={briefScore} isLoading={isScoring} />
        </motion.div>
      )}

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
    </div>
  )
}

export default NewProposal
