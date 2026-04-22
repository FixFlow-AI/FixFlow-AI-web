import { useState } from 'react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/Button'
import api from '@/config/api'

export default function ExportModal({ proposalId, onClose }) {
  const [format, setFormat] = useState('pdf')
  const [isDownloading, setIsDownloading] = useState(false)

  const handleExport = async () => {
    setIsDownloading(true)

    try {
      const response = await api.post(
        `/proposals/${proposalId}/export`,
        { format },
        { responseType: 'blob' }
      )

      const url = window.URL.createObjectURL(response.data)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `proposal.${format}`
      anchor.click()
      window.URL.revokeObjectURL(url)
      toast.success(`Proposal exported as ${format.toUpperCase()}.`)
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.error || 'Export failed.')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full sm:w-96 rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-4 shadow-2xl">
        <div>
          <h2 className="text-lg font-semibold">Export Proposal</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a download format for the current revision.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {['pdf', 'json', 'md'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFormat(value)}
              className={`rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
                format === value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted'
              }`}
            >
              {value.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleExport} isLoading={isDownloading}>
            Download
          </Button>
        </div>
      </div>
    </div>
  )
}
