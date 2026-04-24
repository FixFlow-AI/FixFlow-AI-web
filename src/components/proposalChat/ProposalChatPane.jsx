import { MessageSquare, X } from 'lucide-react'
import ChatMessageThread from './ChatMessageThread'
import ChatInputBar from './ChatInputBar'
import { Canvas } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'
import { motion } from 'framer-motion'

function Header3D() {
  return (
    <div className="w-8 h-8 relative">
      <div className="absolute inset-0 bg-primary/20 blur-md rounded-full" />
      <Canvas camera={{ position: [0, 0, 2] }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <Sphere args={[1, 32, 32]} scale={1.2}>
          <MeshDistortMaterial color="#4f46e5" speed={3} distort={0.3} radius={1} />
        </Sphere>
      </Canvas>
    </div>
  )
}

/**
 * ProposalChatPane
 * 
 * The core chat interface, extracted to be used in either a Sheet (drawer)
 * or a persistent split-view pane.
 */
function ProposalChatPane({
  messages,
  isStreaming,
  currentVersion,
  onSendMessage,
  onClose,
  showClose = false,
}) {
  const versionLabel = currentVersion ? `v${currentVersion}` : ''

  return (
    <div className="flex flex-col h-full bg-card/30 backdrop-blur-xl border-l border-border shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <Header3D />
          <div>
            <span className="text-lg font-semibold">Proposal Chat</span>
            {versionLabel && (
              <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                {versionLabel}
              </span>
            )}
          </div>
        </div>
        {showClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="text-xs text-muted-foreground px-6 py-1.5 bg-muted/30 border-b border-border/50">
        Simultaneous mode active
      </div>

      {/* Message Thread */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ChatMessageThread messages={messages} />
      </div>

      {/* Input Bar */}
      <div className="p-4 border-t border-border">
        <ChatInputBar onSend={onSendMessage} isStreaming={isStreaming} />
      </div>
    </div>
  )
}

export default ProposalChatPane
