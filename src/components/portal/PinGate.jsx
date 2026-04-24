import { useState } from 'react'
import toast from 'react-hot-toast'
import { LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function PinGate({ onVerify, isLoading = false }) {
  const [pin, setPin] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (pin.length !== 4) {
      toast.error('Enter the 4-digit PIN to continue.')
      return
    }

    await onVerify(pin)
  }

  return (
    <div className="glass-card mx-auto max-w-md rounded-[28px] p-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-border bg-background/40">
        <LockKeyhole className="h-7 w-7 text-primary" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold">Protected portal</h2>
      <p className="mt-3 text-sm text-muted-foreground">
        This proposal is protected with a client PIN. Enter the 4-digit code to open the interactive view.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <Input
          value={pin}
          maxLength={4}
          inputMode="numeric"
          pattern="[0-9]*"
          onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="••••"
          className="h-14 text-center text-2xl tracking-[0.8em]"
        />
        <Button type="submit" isLoading={isLoading} className="w-full">
          Unlock proposal
        </Button>
      </form>
    </div>
  )
}
