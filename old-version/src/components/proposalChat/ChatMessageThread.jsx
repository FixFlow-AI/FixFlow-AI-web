import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { User, Bot, Copy, Check } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import MutationConfirmBanner from './MutationConfirmBanner'

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  )
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-primary/60"
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
        />
      ))}
    </div>
  )
}

function ChatMessageThread({ messages }) {
  const scrollRef = useRef(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (!messages.length) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-xs">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-semibold text-sm mb-2">Ready to negotiate</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Ask questions about your proposal or request targeted changes to specific sections.
          </p>
          <div className="mt-4 space-y-2">
            {[
              '"Why is this estimated at 4 weeks?"',
              '"Reduce the timeline by 2 weeks"',
              '"Explain the risk scores to me"',
            ].map((example, i) => (
              <div
                key={i}
                className="text-xs text-muted-foreground/70 bg-muted/30 rounded-lg px-3 py-1.5 italic"
              >
                {example}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.map((msg, index) => {
        // Mutation confirmation banner
        if (msg.type === 'mutation_confirm') {
          return (
            <MutationConfirmBanner
              key={msg.timestamp || index}
              section={msg.section}
              newVersion={msg.newVersion}
              summary={msg.content}
            />
          )
        }

        const isUser = msg.role === 'user'
        const isError = msg.isError

        return (
          <motion.div
            key={msg.timestamp || index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'flex gap-3 group',
              isUser ? 'flex-row-reverse' : 'flex-row'
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                'flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center',
                isUser
                  ? 'bg-primary/20'
                  : isError
                    ? 'bg-red-500/20'
                    : 'bg-accent/20'
              )}
            >
              {isUser ? (
                <User className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Bot className={cn('h-3.5 w-3.5', isError ? 'text-red-400' : 'text-accent-foreground')} />
              )}
            </div>

            {/* Message bubble */}
            <div
              className={cn(
                'max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed',
                isUser
                  ? 'bg-primary/10 text-foreground'
                  : isError
                    ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                    : 'bg-muted/50 border-l-2 border-primary/40 text-foreground'
              )}
            >
              {/* Content */}
              <div className="whitespace-pre-wrap break-words">
                {msg.content}
                {msg.isStreaming && !msg.content && <TypingIndicator />}
              </div>

              {/* Copy button for AI responses */}
              {!isUser && msg.content && !msg.isStreaming && (
                <div className="flex justify-end mt-1">
                  <CopyButton text={msg.content} />
                </div>
              )}

              {/* Streaming cursor */}
              {msg.isStreaming && msg.content && (
                <motion.span
                  className="inline-block w-1.5 h-4 bg-primary/60 ml-0.5 align-text-bottom"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

export default ChatMessageThread
