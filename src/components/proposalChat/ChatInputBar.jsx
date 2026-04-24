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
    <div className="p-4 space-y-3 bg-gradient-to-t from-card/80 to-transparent">
      {/* Intent classification chip */}
      <AnimatePresence mode="wait">
        {intentLabel && input.trim() && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            className="flex items-center gap-2"
          >
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-bold shadow-sm',
                intent === 'mutate'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-primary/20 text-primary-foreground border border-primary/30'
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full animate-pulse',
                  intent === 'mutate' ? 'bg-amber-400' : 'bg-primary'
                )}
              />
              {intentLabel}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="flex items-end gap-2 bg-muted/40 backdrop-blur-md border border-border/50 rounded-2xl p-1.5 shadow-inner transition-all duration-300 focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10">
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
              'w-full resize-none bg-transparent border-none px-3 py-2.5',
              'text-sm text-foreground placeholder:text-muted-foreground/40',
              'focus:outline-none focus:ring-0',
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
            'transition-all duration-300',
            input.trim() && !isStreaming
              ? 'bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-lg shadow-primary/20'
              : 'bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50'
          )}
        >
          {isStreaming ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className={cn("h-5 w-5 transition-transform duration-300", input.trim() && "group-hover:translate-x-1 group-hover:-translate-y-1")} />
          )}
        </button>
      </div>
    </div>
  )
}

export default ChatInputBar
