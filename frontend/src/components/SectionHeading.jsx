import { RevealText } from "./RevealText";

export function SectionHeading({ index, title, copy, align = "split" }) {
  return (
    <header className={`section-heading section-heading--${align}`}>
      <span className="section-index" aria-hidden="true">
        {index}
      </span>
      <RevealText className="section-title">{title}</RevealText>
      {copy ? <p className="section-copy">{copy}</p> : null}
    </header>
  );
}
