import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useIntentClassifier } from '@/hooks/useIntentClassifier'

function ChatInputBar({ onSend, isStreaming }) {
  const [input, setInput] = useState('')
  const textareaRef = useRef(null)
  const { intent, targetSection, intentLabel, classify } = useIntentClassifier()

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 96)}px`
    }
  }, [input])

  const handleInputChange = (e) => {
    setInput(e.target.value)
    classify(e.target.value)
  }

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    onSend(trimmed, intent, targetSection)
    setInput('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border p-4 space-y-2">
      {/* Input area */}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this proposal or request changes..."
            disabled={isStreaming}
            rows={1}
            className={cn(
              'w-full resize-none bg-muted/30 border border-border rounded-xl px-4 py-3',
              'text-sm text-foreground placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center',
            'transition-all duration-200',
            input.trim() && !isStreaming
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Intent classification chip */}
      <AnimatePresence mode="wait">
        {intentLabel && input.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex items-center gap-2"
          >
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                intent === 'mutate'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                  : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  intent === 'mutate' ? 'bg-amber-400' : 'bg-blue-400'
                )}
              />
              {intentLabel}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ChatInputBar
