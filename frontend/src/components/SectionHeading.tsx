import { RevealText } from './RevealText'

interface SectionHeadingProps {
  index: string
  title: string
  copy?: string
  align?: 'left' | 'split'
}

export function SectionHeading({ index, title, copy, align = 'split' }: SectionHeadingProps) {
  return (
    <header className={`section-heading section-heading--${align}`}>
      <span className="section-index" aria-hidden="true">
        {index}
      </span>
      <RevealText className="section-title">{title}</RevealText>
      {copy ? <p className="section-copy">{copy}</p> : null}
    </header>
  )
}
