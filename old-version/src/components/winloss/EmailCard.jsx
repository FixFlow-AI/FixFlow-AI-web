import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import { copyToClipboard } from '@/lib/utils'

export default function EmailCard({ title, email, onSend, isSending = false }) {
  return (
    <div className="rounded-2xl border border-border bg-background/35 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-primary">{title}</div>
          <div className="mt-1 text-base font-semibold">{email.subject}</div>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
          {email.sendTiming}
        </span>
      </div>

      <pre className="whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{email.body}</pre>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={async () => {
            await copyToClipboard(`${email.subject}\n\n${email.body}`)
            toast.success('Email copy saved to clipboard.')
          }}
        >
          Copy
        </Button>
        {onSend && (
          <Button variant="ghost" isLoading={isSending} onClick={onSend}>
            Send via email
          </Button>
        )}
      </div>
    </div>
  )
}
