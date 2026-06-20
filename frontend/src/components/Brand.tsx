interface BrandProps {
  compact?: boolean
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <a className="brand" href="#top" aria-label="FixFlowAI home">
      <span className="brand-mark">
        <img src="/official-logo.png" width="40" height="40" alt="" />
      </span>
      <span className="brand-name">FixFlowAI</span>
      {compact ? null : <span className="brand-edition">Trust workspace</span>}
    </a>
  )
}
