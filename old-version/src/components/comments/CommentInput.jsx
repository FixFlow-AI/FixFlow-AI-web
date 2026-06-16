import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export default function CommentInput({ onSubmit, sections = [], disabled = false }) {
  const [section, setSection] = useState(sections[0] || 'summary')
  const [type, setType] = useState('review')
  const [body, setBody] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!body.trim()) {
      return
    }

    await onSubmit({ section, type, body })
    setBody('')
  }

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <select
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          value={section}
          onChange={(event) => setSection(event.target.value)}
          disabled={disabled}
        >
          {sections.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <select
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm"
          value={type}
          onChange={(event) => setType(event.target.value)}
          disabled={disabled}
        >
          <option value="review">Review request</option>
          <option value="approval">Approval</option>
          <option value="question">Question</option>
          <option value="edit_note">Edit note</option>
        </select>
      </div>
      <textarea
        className="min-h-[110px] w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        placeholder="Leave a section comment for the team..."
        value={body}
        disabled={disabled}
        onChange={(event) => setBody(event.target.value)}
      />
      <Button type="submit" disabled={disabled}>
        Add comment
      </Button>
    </form>
  )
}
