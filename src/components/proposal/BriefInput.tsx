import { Textarea } from '@/components/ui/Input'

interface BriefInputProps {
  value: string
  onChange: (value: string) => void
}

const placeholderText = `Paste your client brief here...

Example:
"We need a mobile app for our restaurant that allows customers to browse the menu, place orders, track delivery, and collect loyalty points. The app should support both iOS and Android, integrate with our existing POS system, and include push notifications for promotions. We expect around 10,000 monthly active users initially, growing to 50,000 within the first year."

Include details like:
• Project goals and objectives
• Target audience and user needs
• Technical requirements or constraints
• Timeline expectations
• Budget considerations (if any)`

function BriefInput({ value, onChange }: BriefInputProps) {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Client Brief</label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholderText}
        className="min-h-[300px] text-base leading-relaxed resize-y"
      />
      <p className="text-xs text-muted-foreground">
        Tip: The more detail you provide, the more accurate your proposal will be.
      </p>
    </div>
  )
}

export default BriefInput
