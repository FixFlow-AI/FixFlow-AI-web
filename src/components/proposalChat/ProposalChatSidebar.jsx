import { MessageSquare } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import ChatMessageThread from './ChatMessageThread'
import ChatInputBar from './ChatInputBar'

/**
 * ProposalChatSidebar
 *
 * Main slide-over panel for the ProposalChat feature.
 * Contains the message thread, input bar, and version indicator.
 */
function ProposalChatSidebar({
  isOpen,
  onClose,
  messages,
  isStreaming,
  currentVersion,
  onSendMessage,
}) {
  const versionLabel = currentVersion ? `v${currentVersion}` : ''

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <MessageSquare className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-lg font-semibold">Proposal Chat</span>
            {versionLabel && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {versionLabel}
              </span>
            )}
          </div>
        </div>
      }
      description="Ask questions or request targeted changes"
      side="right"
      className="!max-w-[400px] sm:!max-w-[400px] !w-full"
    >
      <div className="flex flex-col h-full -m-6">
        {/* Message Thread (flex-1 to fill available space) */}
        <ChatMessageThread messages={messages} />

        {/* Input Bar (pinned to bottom) */}
        <ChatInputBar onSend={onSendMessage} isStreaming={isStreaming} />
      </div>
    </Sheet>
  )
}

export default ProposalChatSidebar
