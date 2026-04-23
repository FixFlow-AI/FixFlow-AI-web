import { MessageSquare } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import ChatMessageThread from './ChatMessageThread'
import ChatInputBar from './ChatInputBar'
import { Canvas } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial } from '@react-three/drei'

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
 * ProposalChatSidebar
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
